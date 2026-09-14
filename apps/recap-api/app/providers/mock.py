from __future__ import annotations

import asyncio
import re

from app.models.contracts import Bridge, Evidence, RecapInput, RecapItem, RecapResult
from app.providers.base import Provider


def _short_text(text: str, limit: int = 72) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    sentence = re.split(r"(?<=[。！？!?])", compact, maxsplit=1)[0]
    return sentence if len(sentence) <= limit else sentence[:limit].rstrip() + "…"


def _quote(text: str, limit: int = 48) -> str:
    clean = text.strip()
    return clean[:limit]


class MockProvider(Provider):
    def __init__(self, summary_version: str, delay_seconds: float = 0.01):
        self.summary_version = summary_version
        self.delay_seconds = delay_seconds

    async def generate(self, recap_input: RecapInput) -> RecapResult:
        await asyncio.sleep(self.delay_seconds)
        selected = recap_input.paragraphs[:5]
        items = [
            RecapItem(
                text=_short_text(paragraph.text),
                evidence=[
                    Evidence(paragraph_id=paragraph.id, quote=_quote(paragraph.text))
                ],
            )
            for paragraph in selected
        ]
        bridge = None
        if recap_input.mode.value == "bridge":
            paragraph = selected[-1]
            bridge = Bridge(
                text=f"接下来可从“{_short_text(paragraph.text, 36)}”这一进展继续阅读。",
                evidence=[
                    Evidence(paragraph_id=paragraph.id, quote=_quote(paragraph.text))
                ],
            )
        warnings = (
            ["仅回顾当前取得的前文。"]
            if recap_input.coverage == "partial-prefix"
            else []
        )
        return RecapResult(
            schema_version=1,
            input_hash=recap_input.input_hash,
            summary_version=self.summary_version,
            items=items,
            bridge=bridge,
            warnings=warnings,
        )
