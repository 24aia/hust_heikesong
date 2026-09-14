import type { ReadingCheckpoint } from "@contracts/types";
import type { ReadingSettings, RuntimeRequest, RuntimeResponse, StorageKey } from "../shared/runtime";
import { checkpointStorageKey } from "../shared/runtime";
import { ReadingError } from "../shared/errors";

export interface ReadingStore {
  getCheckpoint(contentKey: string, kind: ReadingCheckpoint["kind"]): Promise<ReadingCheckpoint | null>;
  saveCheckpoint(checkpoint: ReadingCheckpoint): Promise<{ ignored: boolean }>;
  getSettings(): Promise<ReadingSettings>;
  setSettings(settings: ReadingSettings): Promise<void>;
  clearReadingData(): Promise<void>;
}

async function send<T>(request: RuntimeRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as RuntimeResponse<T>;
  if (!response?.ok) {
    throw new ReadingError("NETWORK_ERROR", response?.error.message ?? "扩展后台没有响应");
  }
  return response.value as T;
}

export class ChromeReadingStore implements ReadingStore {
  async getCheckpoint(contentKey: string, kind: ReadingCheckpoint["kind"]): Promise<ReadingCheckpoint | null> {
    const key = checkpointStorageKey({ contentKey, kind });
    return (await send<ReadingCheckpoint | null>({ type: "LKS_STORAGE_GET", key })) ?? null;
  }

  async saveCheckpoint(checkpoint: ReadingCheckpoint): Promise<{ ignored: boolean }> {
    const response = (await chrome.runtime.sendMessage({
      type: "LKS_SAVE_CHECKPOINT",
      checkpoint,
    } satisfies RuntimeRequest)) as RuntimeResponse;
    if (!response?.ok) throw new ReadingError("NETWORK_ERROR", response?.error.message ?? "断点保存失败");
    return { ignored: Boolean(response.ignored) };
  }

  async getSettings(): Promise<ReadingSettings> {
    const settings = await send<ReadingSettings | null>({ type: "LKS_STORAGE_GET", key: "reading:settings" });
    return settings ?? { enabled: false, mascotCollapsed: false };
  }

  async setSettings(settings: ReadingSettings): Promise<void> {
    await send({ type: "LKS_SETTINGS_SET", settings });
  }

  async clearReadingData(): Promise<void> {
    await send({ type: "LKS_CLEAR_READING" });
  }
}

export class MemoryReadingStore implements ReadingStore {
  private values = new Map<StorageKey, unknown>();

  async getCheckpoint(contentKey: string, kind: ReadingCheckpoint["kind"]): Promise<ReadingCheckpoint | null> {
    return (this.values.get(checkpointStorageKey({ contentKey, kind })) as ReadingCheckpoint | undefined) ?? null;
  }

  async saveCheckpoint(checkpoint: ReadingCheckpoint): Promise<{ ignored: boolean }> {
    const key = checkpointStorageKey(checkpoint);
    const current = this.values.get(key) as ReadingCheckpoint | undefined;
    if (current && current.savedAt >= checkpoint.savedAt) return { ignored: true };
    this.values.set(key, structuredClone(checkpoint));
    return { ignored: false };
  }

  async getSettings(): Promise<ReadingSettings> {
    return (this.values.get("reading:settings") as ReadingSettings | undefined) ?? {
      enabled: false,
      mascotCollapsed: false,
    };
  }

  async setSettings(settings: ReadingSettings): Promise<void> {
    this.values.set("reading:settings", structuredClone(settings));
  }

  async clearReadingData(): Promise<void> {
    for (const key of this.values.keys()) {
      if (key.startsWith("reading:") || key.startsWith("recap-cache:")) this.values.delete(key);
    }
  }
}
