import { describe, expect, it } from "vitest";
import type { ReadingCheckpoint } from "@contracts/types";
import { MemoryReadingStore } from "../src/storage/storage";

function checkpoint(kind: ReadingCheckpoint["kind"], savedAt: string): ReadingCheckpoint {
  return {
    schemaVersion: 1,
    contentKey: "article:1",
    sourceUrl: "https://zhuanlan.zhihu.com/p/1",
    title: "测试",
    kind,
    savedAt,
    sourceFingerprint: "abc",
    anchor: { quote: `${kind} target`, prefix: "", suffix: "", paragraphIndexHint: 1, occurrenceIndex: 0, viewportOffsetPx: 100 },
  };
}

describe("reading storage", () => {
  it("keeps automatic and manual checkpoints independent", async () => {
    const store = new MemoryReadingStore();
    await store.saveCheckpoint(checkpoint("manual", "2026-09-14T00:00:00Z"));
    await store.saveCheckpoint(checkpoint("automatic", "2026-09-14T00:01:00Z"));
    expect((await store.getCheckpoint("article:1", "manual"))?.anchor.quote).toBe("manual target");
    expect((await store.getCheckpoint("article:1", "automatic"))?.anchor.quote).toBe("automatic target");
  });

  it("prevents an older tab from overwriting a newer checkpoint", async () => {
    const store = new MemoryReadingStore();
    await store.saveCheckpoint(checkpoint("automatic", "2026-09-14T00:02:00Z"));
    const stale = await store.saveCheckpoint(checkpoint("automatic", "2026-09-14T00:01:00Z"));
    expect(stale.ignored).toBe(true);
    expect((await store.getCheckpoint("article:1", "automatic"))?.savedAt).toBe("2026-09-14T00:02:00Z");
  });
});
