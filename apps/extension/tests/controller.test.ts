import { describe, expect, it, vi } from "vitest";
import { createCheckpoint } from "../src/bookmarks/checkpoint";
import { ReadingController } from "../src/content/controller";
import { ZhihuPageAdapter } from "../src/page-adapter/zhihu-page-adapter";
import { MemoryReadingStore } from "../src/storage/storage";
import { setPage, setRects } from "./fixtures";
import { ReadingError } from "../src/shared/errors";

describe("ReadingController initialization", () => {
  it("does not start automatic tracking before the old checkpoint is handled", async () => {
    vi.useFakeTimers();
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/9",
      `<article><div itemprop="articleBody"><p>页面顶部。</p><p>历史断点。</p><p>后文。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    setRects(snapshot.paragraphs.map(({ element }) => element), [120, 420, 720]);
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    const old = createCheckpoint(adapter, snapshot, 1, "automatic", new Date("2026-09-14T00:00:00Z"));
    await store.saveCheckpoint(old);
    const saveSpy = vi.spyOn(store, "saveCheckpoint");
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();
    expect(controller.getState().phase).toBe("offer-resume");
    vi.advanceTimersByTime(10_000);
    expect(saveSpy).not.toHaveBeenCalled();
    expect((await store.getCheckpoint("article:9", "automatic"))?.anchor.quote).toBe("历史断点。");
    controller.dispose();
    vi.useRealTimers();
  });

  it("ignores a late restore result after the user cancels", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/10",
      `<article><div itemprop="articleBody"><p>页面顶部。</p><p>历史断点。</p><p>后文。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    await store.saveCheckpoint(createCheckpoint(adapter, snapshot, 1, "manual"));
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();
    let finishRestore: ((value: { status: "located" | "missing" }) => void) | undefined;
    vi.spyOn(controller.host, "resumeReading").mockImplementation(
      () => new Promise((resolve) => { finishRestore = resolve; }),
    );

    const restore = controller.restore();
    controller.cancelRestore();
    finishRestore?.({ status: "missing" });
    await restore;

    expect(controller.getState()).toMatchObject({ phase: "tracking", message: "已取消恢复" });
    controller.dispose();
  });

  it("reports user-interrupted scrolling as cancelled rather than missing content", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/13",
      `<article><div itemprop="articleBody"><p>页面顶部。</p><p>历史断点。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    await store.saveCheckpoint(createCheckpoint(adapter, snapshot, 1, "manual"));
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();
    vi.spyOn(controller.host, "resumeReading").mockRejectedValue(new ReadingError("CANCELLED", "已取消恢复"));

    await controller.restore();

    expect(controller.getState()).toMatchObject({ phase: "tracking", message: "已取消恢复" });
    controller.dispose();
  });

  it("clears saved checkpoints and returns to consent", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/11",
      `<article><div itemprop="articleBody"><p>页面顶部。</p><p>历史断点。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    await store.saveCheckpoint(createCheckpoint(adapter, snapshot, 1, "automatic"));
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();

    await controller.clearLocalData();

    expect(controller.getState()).toMatchObject({ phase: "consent", auto: null, manual: null });
    expect(await store.getCheckpoint("article:11", "automatic")).toBeNull();
    expect((await store.getSettings()).enabled).toBe(false);
    controller.dispose();
  });

  it("allows saving a manual bookmark while the resume offer is still visible", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/14",
      `<article><div itemprop="articleBody"><p>页面顶部。</p><p>自动断点。</p><p>想要手动标记的段落。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    setRects(snapshot.paragraphs.map(({ element }) => element), [120, 420, 720]);
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    await store.saveCheckpoint(createCheckpoint(adapter, snapshot, 1, "automatic"));
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();
    expect(controller.getState().phase).toBe("offer-resume");

    controller.beginManualBookmark();
    // 面板必须保持打开，否则“点击正文段落保存，Esc 取消”这条说明不可见，
    // 用户会以为按钮没有反应。
    expect(controller.getState()).toMatchObject({ phase: "selecting", open: true });
    snapshot.paragraphs[2].element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(controller.getState().manual).not.toBeNull());

    expect(controller.getState().manual?.anchor.quote).toBe("想要手动标记的段落。");
    expect((await store.getCheckpoint("article:14", "automatic"))?.anchor.quote).toBe("自动断点。");
    controller.dispose();
  });

  it("manually bookmarks another loaded answer without creating an automatic checkpoint for it", async () => {
    const location = setPage(
      "https://www.zhihu.com/question/123/answer/456",
      `<h1 class="QuestionHeader-title">一个问题</h1>
       <article class="AnswerItem" data-zop='{"itemId":"456"}'>
         <div class="QuestionAnswer-content"><div class="RichContent-inner"><p>首个回答正文。</p></div></div>
       </article>
       <article class="AnswerItem" data-zop='{"itemId":"789"}'>
         <div class="RichContent-inner"><p>其他回答前文。</p><p>其他回答断点。</p><p>其他回答后文。</p></div>
       </article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();

    controller.beginManualBookmark();
    const otherAnswer = adapter.extractSnapshotByContentKey("answer:789");
    otherAnswer.paragraphs[1].element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(controller.getState().manual?.contentKey).toBe("answer:789"));

    expect((await store.getCheckpoint("answer:789", "manual"))?.anchor.quote).toBe("其他回答断点。");
    expect(await store.getCheckpoint("answer:789", "automatic")).toBeNull();
    const input = await controller.host.getRecapInput("brief");
    expect(input.contentKey).toBe("answer:789");
    expect(input.paragraphs.map(({ text }) => text)).toEqual(["其他回答前文。"]) ;
    expect(JSON.stringify(input)).not.toContain("首个回答正文");
    controller.dispose();
  });

  it("keeps the resume offer on screen after inspecting the recap boundary", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/15",
      `<article><div itemprop="articleBody"><p>页面顶部。</p><p>自动断点。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const store = new MemoryReadingStore();
    await store.setSettings({ enabled: true, mascotCollapsed: false });
    await store.saveCheckpoint(createCheckpoint(adapter, snapshot, 1, "automatic"));
    const controller = new ReadingController(adapter, store, snapshot);
    await controller.initialize();

    await controller.inspectRecapBoundary();

    // 冻结边界只报告范围，不改变阶段，也不产生手动书签。
    expect(controller.getState().phase).toBe("offer-resume");
    expect(controller.getState().manual).toBeNull();
    controller.dispose();
  });

  it("refreshes the tracked paragraph range when the article expands", async () => {
    vi.useFakeTimers();
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/12",
      `<article><div itemprop="articleBody"><p>第一段。</p><p>第二段。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const controller = new ReadingController(adapter, new MemoryReadingStore(), snapshot);
    await controller.initialize();
    const added = document.createElement("p");
    added.textContent = "展开后出现的第三段。";
    snapshot.content.root.append(added);
    await Promise.resolve();
    vi.advanceTimersByTime(250);

    expect(controller.getState().paragraphCount).toBe(3);
    controller.dispose();
    vi.useRealTimers();
  });
});
