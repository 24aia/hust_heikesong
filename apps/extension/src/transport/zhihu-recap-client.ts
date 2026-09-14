import type { RecapClient, RecapInput, RecapResult } from "@contracts/types";
import type { AppError } from "@contracts/types";
import type { RuntimeErrorCode, RuntimeResponse } from "../shared/runtime";
import { browserApi } from "../shared/browser-api";
import { ReadingError } from "../shared/errors";

/**
 * 真实回顾客户端。请求交给后台发起，因为 content script 受页面跨域限制。
 *
 * 取消的限制：AbortSignal 无法跨 runtime 消息边界传递，因此取消只在本端生效——
 * 界面会立即停止等待，但后台那次模型请求仍会跑完。这与 `ReadingController`
 * 已有的“迟到结果不污染界面”策略一致，不会显示已取消的结果。
 */
export class ZhihuRecapClient implements RecapClient {
  async generate(
    input: RecapInput,
    options: { signal?: AbortSignal; onStage?: (stage: "queued" | "running") => void },
  ): Promise<RecapResult> {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    options.onStage?.("queued");

    const pending = browserApi.runtime.sendMessage({
      type: "LKS_RECAP_GENERATE",
      input,
    }) as Promise<RuntimeResponse<RecapResult>>;

    options.onStage?.("running");

    const response = await (options.signal
      ? Promise.race([pending, rejectOnAbort(options.signal)])
      : pending);

    if (!response.ok) {
      throw new ReadingError(
        toAppErrorCode(response.error.code),
        response.error.message,
        response.error.requestId,
      );
    }
    if (!response.value) {
      throw new ReadingError("MODEL_OUTPUT_INVALID", "总结服务未返回结果。");
    }
    return response.value;
  }
}

/**
 * 传输层内部错误码不在契约联合中，统一归为网络错误再交给面板。
 * 这三类代表 content script 与后台之间的通道故障，对用户而言与网络失败等价。
 */
function toAppErrorCode(code: RuntimeErrorCode): AppError["code"] {
  switch (code) {
    case "INVALID_MESSAGE":
    case "FORBIDDEN":
    case "STORAGE_ERROR":
      return "NETWORK_ERROR";
    default:
      return code;
  }
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new DOMException("Cancelled", "AbortError")),
      { once: true },
    );
  });
}
