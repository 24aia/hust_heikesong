import type { ReadingCheckpoint } from "@contracts/types";
import type { ReadingSettings, RuntimeRequest, RuntimeResponse } from "../shared/runtime";
import { checkpointStorageKey } from "../shared/runtime";
import { browserApi } from "../shared/browser-api";
import { ReadingError } from "../shared/errors";
import { generateRecap } from "./recap-provider";

const writeQueues = new Map<string, Promise<unknown>>();
const supportedSender = /^https:\/\/(www\.zhihu\.com\/question\/[^/]+\/answer\/[^/?#]+|zhuanlan\.zhihu\.com\/p\/[^/?#]+)/;

function isSenderAllowed(sender: browser.runtime.MessageSender): boolean {
  return sender.id === browserApi.runtime.id && Boolean(sender.url && (supportedSender.test(sender.url) || sender.url.startsWith(browserApi.runtime.getURL(""))));
}

function isCheckpoint(value: unknown): value is ReadingCheckpoint {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ReadingCheckpoint>;
  return (
    item.schemaVersion === 1 &&
    typeof item.contentKey === "string" &&
    /^(answer|article):[^:]+$/.test(item.contentKey) &&
    (item.kind === "automatic" || item.kind === "manual") &&
    typeof item.savedAt === "string" &&
    !Number.isNaN(Date.parse(item.savedAt)) &&
    typeof item.anchor?.quote === "string" &&
    item.anchor.quote.length > 0 &&
    item.anchor.quote.length <= 500 &&
    typeof item.sourceFingerprint === "string"
  );
}

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prior = writeQueues.get(key) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(task);
  writeQueues.set(key, next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key);
  }));
  return next;
}

async function saveCheckpoint(checkpoint: ReadingCheckpoint): Promise<RuntimeResponse> {
  if (!isCheckpoint(checkpoint)) return { ok: false, error: { code: "INVALID_MESSAGE", message: "断点数据不完整" } };
  const key = checkpointStorageKey(checkpoint);
  return enqueue(key, async () => {
    const existing = (await browserApi.storage.local.get(key))[key] as ReadingCheckpoint | undefined;
    if (existing && existing.savedAt >= checkpoint.savedAt) return { ok: true, ignored: true };
    await browserApi.storage.local.set({ [key]: checkpoint });
    return { ok: true, ignored: false };
  });
}

async function handle(request: RuntimeRequest): Promise<RuntimeResponse> {
  switch (request.type) {
    case "LKS_STORAGE_GET": {
      const value = (await browserApi.storage.local.get(request.key))[request.key] ?? null;
      return { ok: true, value };
    }
    case "LKS_SAVE_CHECKPOINT":
      return saveCheckpoint(request.checkpoint);
    case "LKS_CACHE_SET": {
      if (JSON.stringify(request.value).length > 500_000) {
        return { ok: false, error: { code: "QUOTA_EXCEEDED", message: "单份回顾缓存过大" } };
      }
      await browserApi.storage.local.set({ [request.key]: request.value });
      return { ok: true };
    }
    case "LKS_SETTINGS_SET": {
      const settings: ReadingSettings = {
        enabled: Boolean(request.settings.enabled),
        mascotCollapsed: Boolean(request.settings.mascotCollapsed),
      };
      await browserApi.storage.local.set({ "reading:settings": settings });
      return { ok: true };
    }
    case "LKS_STORAGE_REMOVE":
      await browserApi.storage.local.remove(request.key as string);
      return { ok: true };
    case "LKS_CLEAR_READING": {
      const values = await browserApi.storage.local.get(null);
      const keys = Object.keys(values).filter((key) => key.startsWith("reading:") || key.startsWith("recap-cache:"));
      await browserApi.storage.local.remove(keys);
      return { ok: true };
    }
    case "LKS_RECAP_GENERATE": {
      const result = await generateRecap(request.input);
      return { ok: true, value: result };
    }
    default:
      return { ok: false, error: { code: "INVALID_MESSAGE", message: "未知扩展消息" } };
  }
}

browserApi.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse) => {
  if (!isSenderAllowed(sender)) {
    sendResponse({ ok: false, error: { code: "FORBIDDEN", message: "消息来源不受支持" } } satisfies RuntimeResponse);
    return false;
  }
  handle(request)
    .then(sendResponse)
    .catch((error: unknown) => {
      // 保留 ReadingError 的真实错误码：回顾面板按 code 显示不同标题，
      // 一律回退成 STORAGE_ERROR 会让额度耗尽、限速、引用校验失败都显示为存储错误。
      if (error instanceof ReadingError) {
        sendResponse({
          ok: false,
          error: { code: error.code, message: error.message, requestId: error.requestId },
        } satisfies RuntimeResponse);
        return;
      }
      const message = error instanceof Error ? error.message : "本地存储失败";
      sendResponse({ ok: false, error: { code: "STORAGE_ERROR", message } } satisfies RuntimeResponse);
    });
  return true;
});
