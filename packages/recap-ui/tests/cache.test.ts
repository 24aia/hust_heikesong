import { describe, expect, it } from "vitest";
import { MemoryStore, recapCacheKey } from "../src/cache/cache";
import type { RecapResult } from "../src/types";

const result: RecapResult = {
  schemaVersion: 1,
  inputHash: "a".repeat(64),
  summaryVersion: "recap-v1",
  items: [],
  bridge: null,
  warnings: [],
};

describe("recap cache", () => {
  it("keeps mode and summary version in the key", () => {
    expect(recapCacheKey("hash", "brief", "v1")).toBe("recap-cache:hash:brief:v1");
    expect(recapCacheKey("hash", "brief", "v1")).not.toBe(recapCacheKey("hash", "bridge", "v1"));
  });

  it("stores and removes results", async () => {
    const store = new MemoryStore();
    await store.set("key", result);
    expect(await store.get("key")).toEqual(result);
    await store.remove("key");
    expect(await store.get("key")).toBeNull();
  });
});
