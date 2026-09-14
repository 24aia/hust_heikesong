import type { ReadingCheckpoint } from "@contracts/types";
import { AnchorRestorer } from "../anchor-resolver/restorer";
import { createCheckpoint } from "../bookmarks/checkpoint";
import { ManualBookmarkSelector } from "../bookmarks/manual-selector";
import type { PageAdapter, PageSnapshot } from "../page-adapter/types";
import { ReadingTracker } from "../reading-tracker/reading-tracker";
import type { ReadingStore } from "../storage/storage";
import { ExtensionReadingHost } from "../transport/reading-host";
import { ReadingError } from "../shared/errors";

export type ControllerPhase =
  | "consent"
  | "offer-resume"
  | "tracking"
  | "selecting"
  | "restoring"
  | "restore-failed";

export interface ControllerState {
  phase: ControllerPhase;
  open: boolean;
  collapsed: boolean;
  auto: ReadingCheckpoint | null;
  manual: ReadingCheckpoint | null;
  activeKind: ReadingCheckpoint["kind"];
  currentParagraph: number;
  paragraphCount: number;
  message: string | null;
}

type Listener = (state: ControllerState) => void;

export class ReadingController {
  readonly host: ExtensionReadingHost;
  private readonly restorer: AnchorRestorer;
  private tracker: ReadingTracker | null = null;
  private selector: ManualBookmarkSelector | null = null;
  private contentObserver: MutationObserver | null = null;
  private refreshTimer: number | null = null;
  private listeners = new Set<Listener>();
  private disposed = false;
  private restoreAttempt = 0;
  private state: ControllerState;

  constructor(
    private readonly adapter: PageAdapter,
    private readonly store: ReadingStore,
    private snapshot: PageSnapshot,
  ) {
    this.restorer = new AnchorRestorer(adapter);
    this.host = new ExtensionReadingHost(adapter, this.restorer);
    this.state = {
      phase: "consent",
      open: false,
      collapsed: false,
      auto: null,
      manual: null,
      activeKind: "manual",
      currentParagraph: 0,
      paragraphCount: snapshot.paragraphs.length,
      message: null,
    };
  }

  async initialize(): Promise<void> {
    const [settings, auto, manual] = await Promise.all([
      this.store.getSettings(),
      this.store.getCheckpoint(this.snapshot.content.contentKey, "automatic"),
      this.store.getCheckpoint(this.snapshot.content.contentKey, "manual"),
    ]);
    if (this.disposed) return;
    const preferred = manual ?? auto;
    if (preferred) this.host.freezeCheckpoint(preferred);
    this.update({
      auto,
      manual,
      activeKind: manual ? "manual" : "automatic",
      currentParagraph: preferred ? preferred.anchor.paragraphIndexHint + 1 : 0,
      collapsed: settings.mascotCollapsed,
      phase: !settings.enabled ? "consent" : preferred ? "offer-resume" : "tracking",
      open: !settings.enabled || Boolean(preferred),
    });
    if (settings.enabled && !preferred) this.startTracking();
    this.observeContentChanges();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): ControllerState {
    return { ...this.state };
  }

  toggleOpen(): void {
    this.update({ open: !this.state.open });
  }

  async setCollapsed(collapsed: boolean): Promise<void> {
    const previous = { collapsed: this.state.collapsed, open: this.state.open };
    this.update({ collapsed, open: collapsed ? false : this.state.open });
    try {
      const settings = await this.store.getSettings();
      await this.store.setSettings({ ...settings, mascotCollapsed: collapsed });
    } catch (error) {
      this.update({ ...previous, open: true, message: error instanceof Error ? error.message : "收起状态保存失败" });
    }
  }

  async enable(): Promise<void> {
    try {
      await this.store.setSettings({ enabled: true, mascotCollapsed: false });
      this.update({ phase: "tracking", open: true, collapsed: false, message: "本地记录已开启" });
      this.startTracking();
    } catch (error) {
      this.update({ open: true, message: error instanceof Error ? error.message : "无法开启本地记录" });
    }
  }

  chooseCheckpoint(kind: ReadingCheckpoint["kind"]): void {
    const checkpoint = kind === "manual" ? this.state.manual : this.state.auto;
    if (!checkpoint) return;
    this.host.freezeCheckpoint(checkpoint);
    let paragraphCount = this.state.paragraphCount;
    try {
      paragraphCount = this.adapter.extractSnapshotByContentKey(checkpoint.contentKey).paragraphs.length;
    } catch {
      // Keep the last known count; restore will report if the answer is no longer loaded.
    }
    this.update({ activeKind: kind, currentParagraph: checkpoint.anchor.paragraphIndexHint + 1, paragraphCount });
  }

  ignoreResume(): void {
    this.update({ phase: "tracking", message: "已保留旧断点，本次从当前位置继续" });
    this.startTracking();
  }

  async restore(): Promise<void> {
    const checkpoint = this.state.activeKind === "manual" ? this.state.manual : this.state.auto;
    if (!checkpoint) return;
    const attempt = ++this.restoreAttempt;
    this.tracker?.pause();
    this.host.freezeCheckpoint(checkpoint);
    this.update({ phase: "restoring", message: "正在寻找上次的位置" });
    try {
      const result = await this.host.resumeReading();
      if (this.disposed || attempt !== this.restoreAttempt) return;
      if (result.status === "located") {
        this.update({ phase: "tracking", message: "已回到原段落" });
        this.startTracking();
      } else {
        this.update({ phase: "restore-failed", message: "原文可能已变化，无法准确定位" });
      }
    } catch (error) {
      if (this.disposed || attempt !== this.restoreAttempt) return;
      if (error instanceof ReadingError && error.code === "CANCELLED") {
        this.update({ phase: "tracking", message: "已取消恢复" });
        this.startTracking();
      } else {
        this.update({ phase: "restore-failed", message: error instanceof Error ? error.message : "恢复失败，请稍后重试" });
      }
    }
  }

  cancelRestore(): void {
    this.restoreAttempt += 1;
    this.restorer.cancel();
    this.update({ phase: "tracking", message: "已取消恢复" });
    this.startTracking();
  }

  beginManualBookmark(): void {
    this.tracker?.pause();
    this.selector?.stop();
    let snapshots: PageSnapshot[];
    try {
      snapshots = this.adapter.extractAvailableSnapshots();
    } catch (error) {
      this.update({ open: true, message: error instanceof Error ? error.message : "没有找到可记录的回答" });
      this.startTracking();
      return;
    }
    const targets = snapshots.flatMap((snapshot) =>
      snapshot.paragraphs.map((paragraph, index) => ({ paragraph, index, snapshot })),
    );
    const targetByElement = new Map(targets.map((target) => [target.paragraph.element, target]));
    // 面板必须保持打开：操作说明与失败原因都写在 state.message 里，
    // 而 message 只在面板内渲染。关闭面板会让选择模式完全没有可见反馈。
    this.update({ phase: "selecting", open: true, message: `点击任一已加载回答的正文段落保存，Esc 取消（当前 ${snapshots.length} 个回答）` });
    this.selector = new ManualBookmarkSelector(
      targets.map(({ paragraph }) => paragraph),
      (paragraph) => {
        const target = targetByElement.get(paragraph.element);
        if (target) void this.saveManual(target.snapshot, target.index);
      },
      () => {
        this.update({ phase: "tracking", open: true, message: "已取消标记" });
        this.startTracking();
      },
    );
    this.selector.start();
  }

  cancelManualBookmark(): void {
    if (this.state.phase !== "selecting") return;
    this.selector?.stop();
    this.selector = null;
    this.update({ phase: "tracking", message: "已取消标记" });
    this.startTracking();
  }

  async inspectRecapBoundary(): Promise<void> {
    try {
      const input = await this.host.getRecapInput("brief");
      this.update({ message: `回顾边界已冻结：仅包含断点前 ${input.paragraphs.length} 段` });
    } catch (error) {
      this.update({ message: error instanceof Error ? error.message : "暂时无法生成回顾输入" });
    }
  }

  async clearLocalData(): Promise<void> {
    this.restoreAttempt += 1;
    this.tracker?.pause();
    this.selector?.stop();
    this.selector = null;
    this.restorer.cancel();
    try {
      await this.store.clearReadingData();
      this.host.clearCheckpoint();
      this.update({
        phase: "consent",
        open: true,
        collapsed: false,
        auto: null,
        manual: null,
        activeKind: "manual",
        currentParagraph: 0,
        message: "本地断点与回顾缓存已清除",
      });
    } catch (error) {
      this.update({ open: true, message: error instanceof Error ? error.message : "本地数据清除失败" });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.tracker?.dispose();
    this.selector?.stop();
    this.restorer.cancel();
    this.contentObserver?.disconnect();
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.listeners.clear();
  }

  private startTracking(): void {
    if (this.disposed) return;
    if (!this.tracker) {
      this.tracker = new ReadingTracker(this.snapshot, {
        onStableParagraph: async (index) => {
          const checkpoint = createCheckpoint(this.adapter, this.snapshot, index, "automatic");
          try {
            const result = await this.store.saveCheckpoint(checkpoint);
            if (this.disposed || result.ignored) return;
            this.update({ auto: checkpoint, currentParagraph: index + 1 });
            if (!this.state.manual && this.state.activeKind === "automatic") this.host.freezeCheckpoint(checkpoint);
          } catch (error) {
            if (!this.disposed) this.update({ message: error instanceof Error ? error.message : "自动断点保存失败" });
          }
        },
      });
      this.tracker.start();
    } else {
      this.tracker.resume();
    }
  }

  private observeContentChanges(): void {
    this.contentObserver?.disconnect();
    this.contentObserver = new MutationObserver(() => {
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        this.refreshTimer = null;
        this.refreshSnapshot();
      }, 250);
    });
    const observationRoot = this.snapshot.content.root.parentElement ?? this.snapshot.content.root;
    this.contentObserver.observe(observationRoot, { childList: true, characterData: true, subtree: true });
  }

  private refreshSnapshot(): void {
    if (this.disposed) return;
    try {
      const next = this.adapter.extractSnapshot();
      if (next.content.contentKey !== this.snapshot.content.contentKey || next.sourceFingerprint === this.snapshot.sourceFingerprint) return;
      this.snapshot = next;
      if (this.state.phase === "selecting") {
        this.selector?.stop();
        this.selector = null;
        this.update({ phase: "tracking", open: true, paragraphCount: next.paragraphs.length, message: "正文已更新，请重新选择书签" });
        this.startTracking();
      } else {
        this.update({
          paragraphCount: next.paragraphs.length,
          ...(this.state.phase === "tracking" ? { message: "正文已展开，已更新可记录范围" } : {}),
        });
        this.tracker?.updateSnapshot(next);
      }
      this.observeContentChanges();
    } catch {
      // Temporary DOM transitions are retried by the next content mutation.
    }
  }

  private async saveManual(snapshot: PageSnapshot, index: number): Promise<void> {
    const checkpoint = createCheckpoint(this.adapter, snapshot, index, "manual");
    try {
      const result = await this.store.saveCheckpoint(checkpoint);
      if (result.ignored) throw new Error("有更新的书签已存在，本次未覆盖");
      this.host.freezeCheckpoint(checkpoint);
      this.update({
        manual: checkpoint,
        activeKind: "manual",
        phase: "tracking",
        open: true,
        currentParagraph: index + 1,
        paragraphCount: snapshot.paragraphs.length,
        message: `已记住：${checkpoint.anchor.quote.slice(0, 42)}`,
      });
    } catch (error) {
      this.update({ phase: "tracking", open: true, message: error instanceof Error ? error.message : "书签保存失败" });
    } finally {
      this.selector = null;
      this.startTracking();
    }
  }

  private update(patch: Partial<ControllerState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.getState());
  }
}
