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
