from __future__ import annotations

from pathlib import Path

import pytest

from app.config import Settings
from app.hashing import compute_input_hash
from app.models.contracts import RecapInput


def make_input(mode: str = "brief", coverage: str = "prefix-to-cutoff") -> RecapInput:
    raw = {
        "schemaVersion": 1,
        "contentKey": "answer:demo-1",
        "title": "为什么人会在长文阅读中中断？",
        "sourceUrl": "https://www.zhihu.com/answer/demo-1",
        "inputHash": "0" * 64,
        "mode": mode,
        "cutoff": {"anchorKind": "manual", "policy": "before-paragraph"},
        "coverage": coverage,
        "paragraphs": [
            {"id": "p1", "text": "长文阅读经常被消息和临时任务打断。"},
            {"id": "p2", "text": "重新打开页面时，读者不仅要找回位置，还要重建上下文。"},
            {"id": "p3", "text": "可靠的续读工具应把位置恢复和前文回顾分开处理。"},
        ],
    }
    interim = RecapInput.model_validate(raw)
    return interim.model_copy(update={"input_hash": compute_input_hash(interim)})


@pytest.fixture
def recap_input() -> RecapInput:
    return make_input()


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        provider="mock",
        model="zhida-fast-1p5",
        access_secret=None,
        db_path=tmp_path / "jobs.db",
        job_ttl_seconds=3600,
        max_concurrency=1,
        requests_per_minute=30,
        provider_timeout_seconds=2,
    )
