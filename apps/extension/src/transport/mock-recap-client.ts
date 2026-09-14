import type { RecapClient, RecapInput, RecapResult } from "@contracts/types";

export class MockRecapClient implements RecapClient {
  async generate(
    input: RecapInput,
    options: { signal?: AbortSignal; onStage?: (stage: "queued" | "running") => void },
  ): Promise<RecapResult> {
    options.onStage?.("queued");
    await Promise.resolve();
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    options.onStage?.("running");
    const evidence = input.paragraphs.slice(-1)[0];
    return {
      schemaVersion: 1,
      inputHash: input.inputHash,
      mode: input.mode,
      summaryVersion: "mock-v1",
      items: evidence
        ? [{ text: "这是开发占位结果，不代表真实 AI 总结。", evidence: [{ paragraphId: evidence.id, quote: evidence.text.slice(0, 24) }] }]
        : [],
      bridge: null,
      warnings: ["MockRecapClient 仅用于 Agent A 独立闭环"],
    };
  }
}
