from __future__ import annotations

import httpx
import pytest

from app.providers.base import ProviderFailure
from app.providers.zhihu import ZhihuProvider


@pytest.mark.asyncio
async def test_provider_parses_fenced_json(recap_input):
    quote = recap_input.paragraphs[0].text[:8]
    content = f'''```json
{{"schemaVersion":1,"inputHash":"{recap_input.input_hash}","summaryVersion":"recap-v1","items":[{{"text":"阅读会被打断","evidence":[{{"paragraphId":"p1","quote":"{quote}"}}]}}],"bridge":null,"warnings":[]}}
```'''

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://developer.zhihu.com/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer hidden-test-secret"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": content, "reasoning_content": "not shown"}}]},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = ZhihuProvider("hidden-test-secret", "zhida-fast-1p5", "recap-v1", 2, client)
    try:
        result = await provider.generate(recap_input)
    finally:
        await provider.close()
    assert result.items[0].evidence[0].quote == quote


@pytest.mark.asyncio
async def test_provider_maps_rate_limit_without_exposing_body(recap_input):
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(429, text="internal upstream detail", headers={"x-request-id": "safe-id"})
        )
    )
    provider = ZhihuProvider("hidden-test-secret", "zhida-fast-1p5", "recap-v1", 2, client)
    try:
        with pytest.raises(ProviderFailure) as captured:
            await provider.generate(recap_input)
    finally:
        await provider.close()
    assert captured.value.code.value == "RATE_LIMITED"
    assert captured.value.request_id == "safe-id"
    assert "internal upstream detail" not in captured.value.safe_message


@pytest.mark.asyncio
async def test_provider_distinguishes_quota_exhaustion(recap_input):
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(429, json={"error": {"code": "quota_exceeded", "message": "private"}})
        )
    )
    provider = ZhihuProvider("hidden-test-secret", "zhida-fast-1p5", "recap-v1", 2, client)
    try:
        with pytest.raises(ProviderFailure) as captured:
            await provider.generate(recap_input)
    finally:
        await provider.close()
    assert captured.value.code.value == "QUOTA_EXCEEDED"
