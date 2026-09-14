import type { AnchorKind, ReadingCheckpoint } from "@contracts/types";
import type { PageAdapter, PageSnapshot } from "../page-adapter/types";

export function createCheckpoint(
  adapter: PageAdapter,
  snapshot: PageSnapshot,
  paragraphIndex: number,
  kind: AnchorKind,
  now = new Date(),
): ReadingCheckpoint {
  return {
    schemaVersion: 1,
    contentKey: snapshot.content.contentKey,
    sourceUrl: snapshot.content.sourceUrl,
    title: snapshot.content.title,
    kind,
    anchor: adapter.createAnchor(snapshot, paragraphIndex),
    savedAt: now.toISOString(),
    sourceFingerprint: snapshot.sourceFingerprint,
  };
}
