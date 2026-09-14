import type { CacheStore, RecapMode, RecapResult } from "../types";

export function recapCacheKey(
  inputHash: string,
  mode: RecapMode,
  summaryVersion: string,
): string {
  return `recap-cache:${inputHash}:${mode}:${summaryVersion}`;
}

export class MemoryStore implements CacheStore {
  private readonly records = new Map<string, RecapResult>();

  async get(key: string): Promise<RecapResult | null> {
    return this.records.get(key) ?? null;
  }

  async set(key: string, result: RecapResult): Promise<void> {
    this.records.set(key, result);
  }

  async remove(key: string): Promise<void> {
    this.records.delete(key);
  }
}
