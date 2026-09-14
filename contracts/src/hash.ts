import type { Coverage, Paragraph } from "./types";

export const NORMALIZATION_VERSION = 1 as const;

export function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .normalize("NFC")
    .trim();
}

export async function computeInputHash(
  contentKey: string,
  policy: "before-paragraph",
  coverage: Coverage,
  paragraphs: Paragraph[],
): Promise<string> {
  const payload = JSON.stringify([
    NORMALIZATION_VERSION,
    contentKey,
    policy,
    coverage,
    paragraphs.map((paragraph) => [paragraph.id, paragraph.text]),
  ]);
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function recapCacheKey(inputHash: string, mode: string, summaryVersion: string): string {
  return `recap-cache:${inputHash}:${mode}:${summaryVersion}`;
}
