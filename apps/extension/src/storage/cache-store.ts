import type { CacheStore, RecapResult } from "@contracts/types";
import type { RuntimeResponse, StorageKey } from "../shared/runtime";

export class ChromeCacheStore implements CacheStore {
  async get(key: string): Promise<RecapResult | null> {
    const response = (await chrome.runtime.sendMessage({ type: "LKS_STORAGE_GET", key: key as StorageKey })) as RuntimeResponse<RecapResult>;
    return response.ok ? response.value ?? null : null;
  }

  async set(key: string, result: RecapResult): Promise<void> {
    const response = (await chrome.runtime.sendMessage({
      type: "LKS_CACHE_SET",
      key: key as `recap-cache:${string}`,
      value: result,
    })) as RuntimeResponse;
    if (!response.ok) throw new Error(response.error.message);
  }

  async remove(key: string): Promise<void> {
    await chrome.runtime.sendMessage({ type: "LKS_STORAGE_REMOVE", key: key as StorageKey });
  }
}
