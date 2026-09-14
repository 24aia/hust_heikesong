import { describe, expect, it } from "vitest";
import type { RecapInput, RecapMode } from "@contracts/types";
import { buildRecapPrompt } from "../src/recap/prompt";

function input(mode: RecapMode): RecapInput {
  return {
    schemaVersion: 1,
    contentKey: "answer:prompt-test",
    title: "提示词测试",
    sourceUrl: "https://example.invalid/prompt-test",
    inputHash: "a".repeat(64),
    mode,
    cutoff: { anchorKind: "manual", policy: "before-paragraph" },
    coverage: "prefix-to-cutoff",
    paragraphs: [{ id: "p1", text: "用于验证提示词结构的原始段落。" }],
  };
}

describe("buildRecapPrompt", () => {
  it("shows a bridge object in bridge mode instead of the conflicting null example", () => {
    const prompt = buildRecapPrompt(input("bridge"), "recap-v1");

    expect(prompt).toContain('"bridge": {"text":"衔接说明","evidence":');
    expect(prompt).toContain("bridge 不得为 null、字符串或数组");
  });

  it("keeps bridge null in brief mode", () => {
    const prompt = buildRecapPrompt(input("brief"), "recap-v1");

    expect(prompt).toContain('"bridge": null');
    expect(prompt).toContain("bridge 必须为 null");
  });
});
