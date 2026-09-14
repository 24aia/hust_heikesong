import type { RecapInput, RecapResult } from "@contracts/types";
import { buildRecapPrompt } from "../recap/prompt";
import { parseModelJson, validateRecapResult } from "../recap/validate";
import { SUMMARY_VERSION } from "../recap/version";
import { ReadingError } from "../shared/errors";
import { browserApi } from "../shared/browser-api";

/**
 * 直连知乎直答生成回顾。只在后台运行：content script 受页面跨域限制，
 * 必须由后台发起请求。
 *
 * 密钥在构建时通过 ZHIHU_ACCESS_SECRET 注入，不写进源码、不进 Git。
 * 注意：注入后的密钥在打包产物中是明文，任何拿到 .xpi 的人都能读出来。
 */
declare const __ZHIHU_ACCESS_SECRET__: string;
declare const __RECAP_MODEL__: string;

const ENDPOINT = "https://developer.zhihu.com/v1/chat/completions";
const ORIGIN = "https://developer.zhihu.com/*";
const REQUEST_TIMEOUT_MS = 90_000;

function upstreamErrorCode(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export async function requestModelText(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<unknown> {
  if (!__ZHIHU_ACCESS_SECRET__) {
    throw new ReadingError(
      "NETWORK_ERROR",
      "此构建未内置模型凭证，无法生成回顾。请使用带凭证的构建版本。",
    );
  }

  // 火狐 MV3 把 host_permissions 视为可选授权，不能假设安装即生效。
  const granted = await browserApi.permissions
    .contains({ origins: [ORIGIN] })
    .catch(() => true);
  if (!granted) {
    throw new ReadingError(
      "NETWORK_ERROR",
      "尚未获得访问知乎直答的权限。请在 about:addons 的扩展权限中允许后重试。",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${__ZHIHU_ACCESS_SECRET__}`,
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: __RECAP_MODEL__,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ReadingError("NETWORK_ERROR", "模型请求超时。");
    }
    throw new ReadingError("NETWORK_ERROR", "无法连接总结服务。");
  } finally {
    clearTimeout(timer);
  }

  const requestId = response.headers.get("x-request-id") ?? undefined;
  if (response.status === 429) {
    const payload = await response.json().catch(() => null);
    const quota = upstreamErrorCode(payload).toLowerCase().includes("quota");
    throw new ReadingError(
      quota ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
      quota ? "今日模型额度已用完。" : "模型请求过于频繁。",
      requestId,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new ReadingError("NETWORK_ERROR", "模型服务鉴权失败。", requestId);
  }
  if (!response.ok) {
    throw new ReadingError("NETWORK_ERROR", "模型服务请求失败。", requestId);
  }

  let content: unknown;
  try {
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    content = payload.choices?.[0]?.message?.content;
  } catch {
    throw new ReadingError("MODEL_OUTPUT_INVALID", "模型响应不是合法 JSON。", requestId);
  }

  // reasoning_content 一律不读取，只取最终 content。
  return content;
}

export async function generateRecap(input: RecapInput): Promise<RecapResult> {
  const content = await requestModelText([{ role: "user", content: buildRecapPrompt(input, SUMMARY_VERSION) }]);
  return validateRecapResult(input, parseModelJson(content), SUMMARY_VERSION);
}
