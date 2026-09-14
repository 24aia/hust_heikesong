import type { Evidence, RecapInput, RecapResult } from "@contracts/types";
import { ReadingError } from "../shared/errors";

/**
 * 移植自 apps/recap-api/app/validation/result.py。
 *
 * 这是防止模型编造原文的关键一层：每条引用都必须在对应段落中逐字存在。
 * 校验通过只说明引用真实，不代表语义正确。
 */

/** 模型有时会把 JSON 包在 Markdown 代码块里，剥掉围栏后再解析。 */
export function parseModelJson(content: unknown): Record<string, unknown> {
  if (typeof content !== "string") throw new ReadingError("MODEL_OUTPUT_INVALID", "模型返回内容不是文本");
  let stripped = content.trim();
  if (stripped.startsWith("```")) {
    const lines = stripped.split(/\r?\n/);
    if (lines[0]?.startsWith("```")) lines.shift();
    if (lines.at(-1)?.trim() === "```") lines.pop();
    stripped = lines.join("\n").trim();
  }
  let value: unknown;
  try {
    value = JSON.parse(stripped);
  } catch {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "模型返回内容不是合法 JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "模型输出必须是一个 JSON 对象");
  }
  return value as Record<string, unknown>;
}

function readEvidence(raw: unknown): Evidence[] {
  if (!Array.isArray(raw)) throw new ReadingError("MODEL_OUTPUT_INVALID", "evidence 必须是数组");
  return raw.map((entry) => {
    const item = entry as Partial<Evidence>;
    if (typeof item?.paragraphId !== "string" || typeof item?.quote !== "string") {
      throw new ReadingError("MODEL_OUTPUT_INVALID", "evidence 缺少 paragraphId 或 quote");
    }
    return { paragraphId: item.paragraphId, quote: item.quote };
  });
}

/**
 * 校验并规范化模型输出。`mode` 与 `summaryVersion` 由本端回填，
 * 不信任模型自行声明的值。
 */
export function validateRecapResult(
  input: RecapInput,
  raw: Record<string, unknown>,
  summaryVersion: string,
): RecapResult {
  if (raw.inputHash !== input.inputHash) {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "模型返回的 inputHash 与前文快照不一致");
  }

  const paragraphs = new Map(input.paragraphs.map(({ id, text }) => [id, text]));

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "回顾结果至少需要一个要点");
  }
  const items = raw.items.map((entry) => {
    const item = entry as { text?: unknown; evidence?: unknown };
    if (typeof item?.text !== "string" || item.text.trim().length === 0) {
      throw new ReadingError("MODEL_OUTPUT_INVALID", "要点缺少文本");
    }
    return { text: item.text, evidence: readEvidence(item.evidence) };
  });

  const bridgeRaw = raw.bridge as { text?: unknown; evidence?: unknown } | null | undefined;
  if (input.mode === "bridge" && (bridgeRaw === null || bridgeRaw === undefined)) {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "bridge 模式必须返回衔接说明");
  }
  if (input.mode === "brief" && bridgeRaw !== null && bridgeRaw !== undefined) {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "brief 模式不应返回 bridge");
  }
  let bridge: RecapResult["bridge"] = null;
  if (bridgeRaw !== null && bridgeRaw !== undefined) {
    if (typeof bridgeRaw.text !== "string" || bridgeRaw.text.trim().length === 0) {
      throw new ReadingError("MODEL_OUTPUT_INVALID", "bridge 缺少文本");
    }
    bridge = { text: bridgeRaw.text, evidence: readEvidence(bridgeRaw.evidence) };
  }

  const groups = [...items.map(({ evidence }) => evidence), ...(bridge ? [bridge.evidence] : [])];
  for (const group of groups) {
    if (group.length === 0) throw new ReadingError("MODEL_OUTPUT_INVALID", "每个部分都需要原文证据");
    for (const evidence of group) {
      const paragraph = paragraphs.get(evidence.paragraphId);
      if (paragraph === undefined) {
        throw new ReadingError("MODEL_OUTPUT_INVALID", `引用了不存在的段落：${evidence.paragraphId}`);
      }
      if (!paragraph.includes(evidence.quote)) {
        throw new ReadingError("MODEL_OUTPUT_INVALID", "引用文本未在对应段落中逐字出现");
      }
    }
  }

  return {
    schemaVersion: 1,
    inputHash: input.inputHash,
    mode: input.mode,
    summaryVersion,
    items,
    bridge,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === "string") : [],
  };
}
