import { computeInputHash } from "@contracts/hash";
import type { ReadingCheckpoint, ReadingHost, RecapInput, RecapMode } from "@contracts/types";
import { AnchorRestorer } from "../anchor-resolver/restorer";
import type { PageAdapter, PageSnapshot } from "../page-adapter/types";
import { ReadingError } from "../shared/errors";

interface FrozenSnapshot {
  snapshot: PageSnapshot;
  checkpoint: ReadingCheckpoint;
  inputHash: string;
  paragraphElements: Map<string, HTMLElement>;
}

const RECAP_INPUT_LIMIT_CODE_POINTS = 20_000;

export class ExtensionReadingHost implements ReadingHost {
  private checkpoint: ReadingCheckpoint | null = null;
  private readonly snapshots = new Map<string, FrozenSnapshot>();

  constructor(
    private readonly adapter: PageAdapter,
    private readonly restorer: AnchorRestorer,
  ) {}

  freezeCheckpoint(checkpoint: ReadingCheckpoint): void {
    this.checkpoint = structuredClone(checkpoint);
  }

  clearCheckpoint(): void {
    this.checkpoint = null;
    this.snapshots.clear();
  }

  async getRecapInput(mode: RecapMode): Promise<RecapInput> {
    const checkpoint = this.checkpoint;
    if (!checkpoint) throw new ReadingError("ANCHOR_NOT_FOUND", "请先选择一个阅读断点");
    const snapshot = this.adapter.extractSnapshotByContentKey(checkpoint.contentKey);
    if (snapshot.content.contentKey !== checkpoint.contentKey) throw new ReadingError("ANCHOR_NOT_FOUND", "当前正文与断点不一致");
    const resolution = this.adapter.locateAnchor(snapshot, checkpoint.anchor);
    if (resolution.status !== "located") throw new ReadingError("ANCHOR_NOT_FOUND", "原文可能已变化，无法确定回顾边界");
    const paragraphs = snapshot.paragraphs.slice(0, resolution.index).map(({ id, text }) => ({ id, text }));
    if (paragraphs.length === 0) throw new ReadingError("INPUT_INSUFFICIENT", "断点位于文章开头，没有可回顾的前文");
    const codePointCount = paragraphs.reduce((count, paragraph) => count + Array.from(paragraph.text).length, 0);
    if (codePointCount > RECAP_INPUT_LIMIT_CODE_POINTS) {
      throw new ReadingError("INPUT_TOO_LARGE", "断点前正文超过 20,000 个字符，暂时无法完整回顾");
    }
    const inputHash = await computeInputHash(
      snapshot.content.contentKey,
      "before-paragraph",
      snapshot.content.coverage,
      paragraphs,
    );
    this.snapshots.set(inputHash, {
      snapshot,
      checkpoint,
      inputHash,
      paragraphElements: new Map(snapshot.paragraphs.map(({ id, element }) => [id, element])),
    });
    return {
      schemaVersion: 1,
      contentKey: snapshot.content.contentKey,
      title: snapshot.content.title,
      sourceUrl: snapshot.content.sourceUrl,
      inputHash,
      mode,
      cutoff: { anchorKind: checkpoint.kind, policy: "before-paragraph" },
      coverage: snapshot.content.coverage,
      paragraphs,
    };
  }

  async locateParagraph(contentKey: string, inputHash: string, paragraphId: string): Promise<{ status: "located" | "stale" | "missing" }> {
    const frozen = this.snapshots.get(inputHash);
    if (!frozen || frozen.snapshot.content.contentKey !== contentKey) return { status: "stale" };
    let current: PageSnapshot;
    try {
      current = this.adapter.extractSnapshotByContentKey(contentKey);
    } catch {
      return { status: "missing" };
    }
    if (current.content.contentKey !== contentKey || current.sourceFingerprint !== frozen.snapshot.sourceFingerprint) return { status: "stale" };
    const target = current.paragraphs.find(({ id }) => id === paragraphId)?.element;
    if (!target) return { status: "missing" };
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return { status: "located" };
  }

  async resumeReading(): Promise<{ status: "located" | "missing" }> {
    if (!this.checkpoint) return { status: "missing" };
    const snapshot = this.adapter.extractSnapshotByContentKey(this.checkpoint.contentKey);
    const result = await this.restorer.restore(snapshot, this.checkpoint);
    if (result.status === "cancelled") throw new ReadingError("CANCELLED", "已取消恢复");
    return { status: result.status === "located" ? "located" : "missing" };
  }
}
