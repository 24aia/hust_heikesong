import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExplanationPanel } from "../src/explanation/ExplanationPanel";
import { explanationMessages } from "../src/explanation/types";
import { readExplanationSelection } from "../src/explanation/selection";
import { browserApi } from "../src/shared/browser-api";

vi.mock("../src/shared/browser-api", () => ({ browserApi: { runtime: { sendMessage: vi.fn() } } }));

function select(text = "context word ending", start = 8, end = 12) {
  const root = document.createElement("div");
  root.className = "RichContent-inner";
  const p = document.createElement("p");
  p.textContent = text;
  root.append(p);
  document.body.append(root);
  const range = document.createRange();
  range.setStart(p.firstChild!, start);
  range.setEnd(p.firstChild!, end);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  return root;
}
afterEach(() => { cleanup(); document.body.replaceChildren(); window.getSelection()?.removeAllRanges(); vi.resetAllMocks(); });

describe("explicit word explanation", () => {
  it("retains selected text after selection collapses, sends only on confirmation, and carries follow-up history", async () => {
    select();
    vi.mocked(browserApi.runtime.sendMessage).mockResolvedValue({ ok: true, value: "A short explanation." });
    render(<ExplanationPanel onClose={vi.fn()} onBusy={vi.fn()} />);
    expect(browserApi.runtime.sendMessage).not.toHaveBeenCalled();
    act(() => { window.getSelection()!.removeAllRanges(); document.dispatchEvent(new Event("selectionchange")); });
    fireEvent.click(screen.getByRole("button", { name: "开始解释" }));
    await screen.findByText("A short explanation.");
    expect(vi.mocked(browserApi.runtime.sendMessage).mock.calls[0][0]).toEqual({ type: "LKS_EXPLAIN", input: { text: "word", context: "context word ending", history: [] } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Give an example" } });
    fireEvent.click(screen.getByRole("button", { name: "发送追问" }));
    await waitFor(() => expect(browserApi.runtime.sendMessage).toHaveBeenCalledTimes(2));
    const request = vi.mocked(browserApi.runtime.sendMessage).mock.calls[1][0] as unknown as { input: { history: unknown } };
    expect(request.input.history).toEqual([{ role: "assistant", content: "A short explanation." }, { role: "user", content: "Give an example" }]);
  });
  it("ignores a response after stopping and reselecting", async () => {
    select();
    let finish!: (value: unknown) => void;
    vi.mocked(browserApi.runtime.sendMessage).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onBusy = vi.fn();
    render(<ExplanationPanel onClose={vi.fn()} onBusy={onBusy} />);
    fireEvent.click(screen.getByRole("button", { name: "开始解释" }));
    expect(onBusy).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "停止等待" }));
    fireEvent.click(screen.getByRole("button", { name: "重新选择词句" }));
    await act(async () => finish({ ok: true, value: "late result" }));
    expect(screen.queryByText("late result")).toBeNull();
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });
  it("rejects oversized selections and selections outside article content", () => {
    const root = select();
    root.className = "CommentList";
    expect(readExplanationSelection()).toBeNull();
    select("x".repeat(1001), 0, 1001);
    expect(() => readExplanationSelection()).toThrow("1,000");
  });
  it("validates history roles and does not use the recap JSON protocol", () => {
    const input = { text: "word", context: "a word", history: [] };
    expect(explanationMessages(input)[0].content).toContain("不需要 JSON");
    expect(() => explanationMessages({ ...input, history: [{ role: "user", content: "bad" }] })).toThrow();
    expect(() => explanationMessages({ ...input, text: "x".repeat(1001) })).toThrow();
  });
});
