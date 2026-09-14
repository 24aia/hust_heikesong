import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../src/cache/cache";
import { RecapPanel } from "../src/panel/RecapPanel";
import type { ReadingHost, RecapClient, RecapInput, RecapResult } from "../src/types";

const input: RecapInput = {
  schemaVersion: 1,
  contentKey: "answer:test",
  title: "测试文章",
  sourceUrl: "https://example.invalid/test",
  inputHash: "a".repeat(64),
  mode: "brief",
  cutoff: { anchorKind: "manual", policy: "before-paragraph" },
  coverage: "prefix-to-cutoff",
  paragraphs: [{ id: "p1", text: "这是用于测试引用定位的原文。" }],
};

const result: RecapResult = {
  schemaVersion: 1,
  inputHash: input.inputHash,
  summaryVersion: "recap-v1",
  items: [{ text: "测试要点", evidence: [{ paragraphId: "p1", quote: "测试引用定位" }] }],
  bridge: null,
  warnings: [],
};

function host(): ReadingHost {
  return {
    getRecapInput: vi.fn(async (mode) => ({ ...input, mode })),
    locateParagraph: vi.fn(async () => ({ status: "located" as const })),
    resumeReading: vi.fn(async () => ({ status: "located" as const })),
  };
}

describe("RecapPanel", () => {
  it("generates a recap and locates its citation", async () => {
    const readingHost = host();
    const client: RecapClient = { generate: vi.fn(async () => result) };
    render(<RecapPanel host={readingHost} client={client} cache={new MemoryStore()} summaryVersion="recap-v1" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "开始回顾" }));
    expect(await screen.findByText("测试要点")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "原文 1" }));
    expect(await screen.findByText("已定位并高亮原文。")).toBeInTheDocument();
    expect(readingHost.locateParagraph).toHaveBeenCalledWith("answer:test", input.inputHash, "p1");
  });

  it("does not let an old request overwrite a new mode", async () => {
    let resolveOld!: (value: RecapResult) => void;
    const oldPromise = new Promise<RecapResult>((resolve) => { resolveOld = resolve; });
    const bridgeResult = { ...result, bridge: { text: "衔接结果", evidence: result.items[0].evidence } };
    const client: RecapClient = {
      generate: vi.fn()
        .mockImplementationOnce(() => oldPromise)
        .mockResolvedValueOnce(bridgeResult),
    };
    render(<RecapPanel host={host()} client={client} cache={new MemoryStore()} summaryVersion="recap-v1" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "开始回顾" }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("tab", { name: "衔接思路" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "衔接思路" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByRole("button", { name: "开始回顾" }));
    expect(await screen.findByText("衔接结果")).toBeInTheDocument();
    resolveOld(result);
    await waitFor(() => expect(screen.getByText("衔接结果")).toBeInTheDocument());
  });
});
