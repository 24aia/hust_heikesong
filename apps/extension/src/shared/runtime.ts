import type { AppError, ReadingCheckpoint, RecapInput } from "@contracts/types";

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
  | { type: "LKS_CLEAR_READING" }
  // 回顾请求必须交给后台：content script 受页面跨域限制，无法直接访问模型服务。
  | { type: "LKS_RECAP_GENERATE"; input: RecapInput };

export type RuntimeResponse<T = unknown> =
  | { ok: true; value?: T; ignored?: boolean }
  | { ok: false; error: RuntimeError };

/**
 * 传输层错误码 = 契约错误码 + 扩展内部的消息校验与存储错误。
 * 后三类只存在于 content script 与后台之间，不跨扩展边界，因此不进 contracts。
 */
export type RuntimeErrorCode = AppError["code"] | "INVALID_MESSAGE" | "FORBIDDEN" | "STORAGE_ERROR";

/** 保留 code 与 requestId，以便回顾面板区分额度耗尽、限速与引用校验失败。 */
export interface RuntimeError {
  code: RuntimeErrorCode;
  message: string;
  requestId?: string;
}

export function checkpointStorageKey(checkpoint: Pick<ReadingCheckpoint, "kind" | "contentKey">): StorageKey {
  const kind = checkpoint.kind === "automatic" ? "auto" : "manual";
  return `reading:${kind}:${checkpoint.contentKey}`;
}
