import type {
  AppError,
  ReadingHost,
  RecapClient,
  RecapInput,
  RecapMode,
  RecapResult,
} from "../src/types";

export type Scenario = "normal" | "beginning" | "partial" | "stale" | "timeout" | "invalid" | "slow";

const paragraphs = [
  { id: "p1", text: "人们很少一次读完一篇长文。消息提醒、临时任务和通勤到站，都会把注意力从文章中拉走。" },
  { id: "p2", text: "再次回来时，困难不只是找到滚动位置。读者还需要想起作者提出了什么问题，论证已经推进到了哪里。" },
  { id: "p3", text: "因此，续读工具要保存两样东西：稳定的文本位置，以及断点之前可核对的思路摘要。" },
  { id: "p4", text: "位置恢复应优先匹配原文与前后文，像素偏移只能作为辅助，因为窗口宽度和图片加载都会改变布局。" },
  { id: "p5", text: "摘要中的每个要点都应附带原文引用。读者点击引用后，可以亲自检查上下文，而不是盲目信任模型。" },
];

export class MockHost implements ReadingHost {
  constructor(private readonly scenario: Scenario, private readonly onEvent: (value: string) => void) {}

  async getRecapInput(mode: RecapMode): Promise<RecapInput> {
    if (this.scenario === "beginning") {
      throw error("INPUT_INSUFFICIENT", "当前断点位于文章开头，没有足够的前文可回顾。");
    }
    return {
      schemaVersion: 1,
      contentKey: "answer:original-playground",
      title: "为什么我们需要一个续读助手？",
      sourceUrl: "https://example.invalid/original-reading-sample",
      inputHash: this.scenario.padEnd(64, "0").slice(0, 64),
      mode,
      cutoff: { anchorKind: "manual", policy: "before-paragraph" },
      coverage: this.scenario === "partial" ? "partial-prefix" : "prefix-to-cutoff",
      paragraphs,
    };
  }

  async locateParagraph(_contentKey: string, _inputHash: string, paragraphId: string) {
    this.onEvent(`定位请求：${paragraphId}`);
    return { status: this.scenario === "stale" ? "stale" : "located" } as const;
  }

  async resumeReading() {
    this.onEvent("继续阅读请求");
    return { status: "located" } as const;
  }
}

export class MockRecapClient implements RecapClient {
  constructor(private readonly scenario: Scenario) {}

  async generate(
    input: RecapInput,
    options: { signal?: AbortSignal; onStage?: (stage: "queued" | "running") => void },
  ): Promise<RecapResult> {
    options.onStage?.("queued");
    await wait(this.scenario === "slow" ? 1200 : 180, options.signal);
    options.onStage?.("running");
    await wait(this.scenario === "timeout" ? 1200 : 420, options.signal);
    if (this.scenario === "timeout") throw error("NETWORK_ERROR", "模拟：模型请求超时。");
    if (this.scenario === "invalid") throw error("MODEL_OUTPUT_INVALID", "模拟：模型引用未通过逐字检查。");
    const result: RecapResult = {
      schemaVersion: 1,
      inputHash: input.inputHash,
      summaryVersion: "recap-v1",
      items: [
        {
          text: "阅读中断后，用户既要找回位置，也要重新建立前文上下文。",
          evidence: [{ paragraphId: "p2", quote: "困难不只是找到滚动位置" }],
        },
        {
          text: "可靠的方案把文本定位与可核对的前文摘要组合起来。",
          evidence: [{ paragraphId: "p3", quote: "稳定的文本位置，以及断点之前可核对的思路摘要" }],
        },
        {
          text: "引用让读者可以返回原文检查模型总结。",
          evidence: [{ paragraphId: "p5", quote: "读者点击引用后，可以亲自检查上下文" }],
        },
      ],
      bridge: input.mode === "bridge" ? {
        text: "前文已经确定了定位与回顾两条线，接下来可以继续了解它们如何配合。",
        evidence: [{ paragraphId: "p3", quote: "续读工具要保存两样东西" }],
      } : null,
      warnings: input.coverage === "partial-prefix" ? ["仅回顾当前取得的前文。"] : [],
    };
    return result;
  }
}

function error(code: AppError["code"], message: string): AppError {
  return { code, message };
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}
