import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReadingController } from "../src/content/controller";
import { ReaderCompanion } from "../src/mascot/ReaderCompanion";

vi.mock("../src/shared/browser-api", () => ({
  browserApi: { runtime: { getURL: (path: string) => path } },
}));

vi.mock("@liukanshan/recap-ui", () => ({
  RecapPanel: ({ onClose }: { onClose(): void }) => (
    <section aria-label="前文回顾面板">
      <button type="button" onClick={onClose}>关闭回顾</button>
    </section>
  ),
}));

function controller(): ReadingController {
  const state = {
    phase: "tracking" as const,
    open: true,
    collapsed: false,
    auto: null,
    manual: {
      schemaVersion: 1 as const,
      contentKey: "answer:1",
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
      title: "测试回答",
      kind: "manual" as const,
      anchor: {
        quote: "断点段落。",
        prefix: "",
        suffix: "",
        paragraphIndexHint: 1,
        occurrenceIndex: 0,
        viewportOffsetPx: 100,
      },
      savedAt: "2026-09-14T00:00:00.000Z",
      sourceFingerprint: "fingerprint",
    },
    activeKind: "manual" as const,
    currentParagraph: 2,
    paragraphCount: 3,
    message: null,
  };
  return {
    host: {},
    getState: () => state,
    subscribe: () => () => undefined,
    toggleOpen: vi.fn(),
    setCollapsed: vi.fn(),
    chooseCheckpoint: vi.fn(),
    restore: vi.fn(),
    ignoreResume: vi.fn(),
    cancelRestore: vi.fn(),
    beginManualBookmark: vi.fn(),
    cancelManualBookmark: vi.fn(),
    clearLocalData: vi.fn(),
  } as unknown as ReadingController;
}

describe("ReaderCompanion recap transition", () => {
  afterEach(cleanup);
  it("replaces the companion panel with the recap panel and restores it on close", () => {
    render(<ReaderCompanion controller={controller()} />);

    fireEvent.click(screen.getByRole("button", { name: "回顾到这里" }));

    expect(screen.getByRole("region", { name: "前文回顾面板" })).toBeTruthy();
    expect(screen.queryByText("刘看山阅读伙伴")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "关闭回顾" }));
    expect(screen.getByRole("button", { name: "切换到最近停留" }).textContent).toContain("手动书签");
    expect(screen.getByRole("button", { name: "打开刘看山阅读伙伴" })).toBeTruthy();
  });
  it("opens explanation only explicitly and exits bookmark selection", () => {
    const host = controller();
    render(<ReaderCompanion controller={host} />);
    fireEvent(document, new Event("selectionchange"));
    expect(screen.queryByRole("region", { name: "词句解释" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "解释词句" }));
    expect(host.cancelManualBookmark).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "词句解释" })).toBeTruthy();
  });
  it("switches through the existing checkpoint method and disables absent records", () => {
    const host = controller();
    const state = host.getState();
    state.auto = { ...state.manual!, kind: "automatic" };
    host.getState = () => state;
    render(<ReaderCompanion controller={host} />);
    fireEvent.click(screen.getByRole("button", { name: "切换到最近停留" }));
    expect(host.chooseCheckpoint).toHaveBeenCalledWith("automatic");
    expect(screen.queryByText("刘看山阅读伙伴")).toBeNull();
  });
});
