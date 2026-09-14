from __future__ import annotations

import json
import time

import httpx
from pydantic import ValidationError

from app.models.contracts import AppErrorCode, RecapInput, RecapResult
from app.prompts.recap import build_recap_prompt
from app.providers.base import Provider, ProviderFailure


class ZhihuProvider(Provider):
    endpoint = "https://developer.zhihu.com/v1/chat/completions"

    def __init__(
        self,
        access_secret: str,
        model: str,
        summary_version: str,
        timeout_seconds: float,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._access_secret = access_secret
        self._model = model
        self._summary_version = summary_version
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)

    async def generate(self, recap_input: RecapInput) -> RecapResult:
        try:
            response = await self._client.post(
                self.endpoint,
                headers={
                    "Authorization": f"Bearer {self._access_secret}",
                    "X-Request-Timestamp": str(int(time.time())),
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": [
                        {
                            "role": "user",
                            "content": build_recap_prompt(
                                recap_input, self._summary_version
                            ),
                        }
                    ],
                    "stream": False,
                },
            )
        except httpx.TimeoutException as exc:
            raise ProviderFailure(AppErrorCode.NETWORK_ERROR, "模型请求超时。") from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure(AppErrorCode.NETWORK_ERROR, "无法连接总结服务。") from exc

        request_id = response.headers.get("x-request-id")
        if response.status_code == 429:
            code = (
                AppErrorCode.QUOTA_EXCEEDED
                if "quota" in _upstream_error_code(response).lower()
                else AppErrorCode.RATE_LIMITED
            )
            message = "今日模型额度已用完。" if code is AppErrorCode.QUOTA_EXCEEDED else "模型请求过于频繁。"
            raise ProviderFailure(code, message, request_id)
        if response.status_code in (401, 403):
            raise ProviderFailure(AppErrorCode.NETWORK_ERROR, "模型服务鉴权失败。", request_id)
        if not response.is_success:
            raise ProviderFailure(AppErrorCode.NETWORK_ERROR, "模型服务请求失败。", request_id)

        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            parsed = _parse_json_object(content)
            return RecapResult.model_validate(parsed)
        except (ValueError, KeyError, IndexError, TypeError, ValidationError) as exc:
            raise ProviderFailure(
                AppErrorCode.MODEL_OUTPUT_INVALID,
                "模型返回内容未通过结构校验。",
                request_id,
            ) from exc

    async def close(self) -> None:
        await self._client.aclose()


def _parse_json_object(content: object) -> dict[str, object]:
    if not isinstance(content, str):
        raise ValueError("model content is not text")
    stripped = content.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    value = json.loads(stripped)
    if not isinstance(value, dict):
        raise ValueError("model output must be an object")
    return value


def _upstream_error_code(response: httpx.Response) -> str:
    try:
        payload = response.json()
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        return str(error.get("code", "")) if isinstance(error, dict) else ""
    except ValueError:
        return ""
