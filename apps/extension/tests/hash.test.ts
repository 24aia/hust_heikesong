import { describe, expect, it } from "vitest";
import { computeInputHash, normalizeText, recapCacheKey } from "@contracts/hash";

describe("contract hashing", () => {
  it("normalizes Unicode and newlines without removing semantic punctuation", () => {
    expect(normalizeText(" e\u0301\r\n数学：1＋1。\u00a0")).toBe("é\n数学：1＋1。");
  });

  it("keeps mode outside the input hash and inside the cache key", async () => {
    const paragraphs = [{ id: "p-0", text: "中文\nemoji 😀" }];
    const hash = await computeInputHash("article:1", "before-paragraph", "prefix-to-cutoff", paragraphs);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(recapCacheKey(hash, "brief", "v1")).not.toBe(recapCacheKey(hash, "bridge", "v1"));
  });
});
