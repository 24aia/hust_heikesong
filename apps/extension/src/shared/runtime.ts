import type { ReadingCheckpoint } from "@contracts/types";

export interface ReadingSettings {
  enabled: boolean;
  mascotCollapsed: boolean;
}

export type StorageKey =
  | `reading:auto:${string}`
  | `reading:manual:${string}`
  | "reading:settings"
  | `recap-cache:${string}`;

export type RuntimeRequest =
  | { type: "LKS_STORAGE_GET"; key: StorageKey }
  | { type: "LKS_SAVE_CHECKPOINT"; checkpoint: ReadingCheckpoint }
  | { type: "LKS_CACHE_SET"; key: `recap-cache:${string}`; value: unknown }
  | { type: "LKS_SETTINGS_SET"; settings: ReadingSettings }
  | { type: "LKS_STORAGE_REMOVE"; key: StorageKey }
  | { type: "LKS_CLEAR_READING" };

export type RuntimeResponse<T = unknown> =
  | { ok: true; value?: T; ignored?: boolean }
  | { ok: false; error: { code: string; message: string } };

export function checkpointStorageKey(checkpoint: Pick<ReadingCheckpoint, "kind" | "contentKey">): StorageKey {
  const kind = checkpoint.kind === "automatic" ? "auto" : "manual";
  return `reading:${kind}:${checkpoint.contentKey}`;
}
