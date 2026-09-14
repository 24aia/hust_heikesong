import { describe, expect, it, vi } from "vitest";
import { ZhihuPageAdapter } from "../src/page-adapter/zhihu-page-adapter";
import { ReadingTracker } from "../src/reading-tracker/reading-tracker";
import { setPage, setRects } from "./fixtures";

describe("ReadingTracker", () => {
  it("waits for a stable paragraph before saving", () => {
    vi.useFakeTimers();
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/1",
      `<article><div itemprop="articleBody"><p>第一段。</p><p>第二段。</p><p>第三段。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    setRects(snapshot.paragraphs.map(({ element }) => element), [-120, 250, 520]);
    const onStableParagraph = vi.fn();
    const tracker = new ReadingTracker(snapshot, { stableMs: 1500, throttleMs: 3000, onStableParagraph });
    tracker.start();
    vi.advanceTimersByTime(1499);
    expect(onStableParagraph).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStableParagraph).toHaveBeenCalledWith(1);
    tracker.dispose();
    vi.useRealTimers();
  });

  it("does not lose a new candidate during the throttle window", () => {
    vi.useFakeTimers();
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/2",
      `<article><div itemprop="articleBody"><p>第一段。</p><p>第二段。</p><p>第三段。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    setRects(snapshot.paragraphs.map(({ element }) => element), [250, 520, 800]);
    const onStableParagraph = vi.fn();
    const tracker = new ReadingTracker(snapshot, { stableMs: 100, throttleMs: 1000, onStableParagraph });
    tracker.start();
    vi.advanceTimersByTime(100);
    expect(onStableParagraph).toHaveBeenCalledWith(0);
    setRects(snapshot.paragraphs.map(({ element }) => element), [-100, 250, 520]);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(100);
    expect(onStableParagraph).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(900);
    expect(onStableParagraph).toHaveBeenCalledWith(1);
    tracker.dispose();
    vi.useRealTimers();
  });

  it("prefers the long paragraph crossing the reading line over the following paragraph", () => {
    vi.useFakeTimers();
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/3",
      `<article><div itemprop="articleBody"><p>很长的当前段落。</p><p>尚未读到的下一段。</p></div></article>`,
    );
    const snapshot = new ZhihuPageAdapter(document, location).extractSnapshot();
    vi.spyOn(snapshot.paragraphs[0].element, "getBoundingClientRect").mockReturnValue({
      x: 0, y: -400, top: -400, bottom: 400, left: 0, right: 600, width: 600, height: 800, toJSON: () => ({}),
    });
    vi.spyOn(snapshot.paragraphs[1].element, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 420, top: 420, bottom: 500, left: 0, right: 600, width: 600, height: 80, toJSON: () => ({}),
    });
    const onStableParagraph = vi.fn();
    const tracker = new ReadingTracker(snapshot, { stableMs: 100, onStableParagraph });
    tracker.start();
    vi.advanceTimersByTime(100);

    expect(onStableParagraph).toHaveBeenCalledWith(0);
    tracker.dispose();
    vi.useRealTimers();
  });
});
