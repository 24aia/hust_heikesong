from __future__ import annotations

import asyncio
import argparse
import json
import os

from app.hashing import compute_input_hash
from app.models.contracts import RecapInput
from app.providers.zhihu import ZhihuProvider
from app.providers.base import ProviderFailure
from app.validation.result import validate_recap_result


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-result", action="store_true")
    args = parser.parse_args()
    secret = os.environ.get("ZHIHU_ACCESS_SECRET", "").strip()
    if not secret:
        raise SystemExit("ZHIHU_ACCESS_SECRET is required")
    raw = {
        "schemaVersion": 1,
        "contentKey": "article:provider-verification",
        "title": "续读助手原创验证材料",
        "sourceUrl": "https://example.invalid/provider-verification",
        "inputHash": "0" * 64,
        "mode": "brief",
        "cutoff": {"anchorKind": "manual", "policy": "before-paragraph"},
        "coverage": "prefix-to-cutoff",
        "paragraphs": [
            {"id": "p1", "text": "阅读长文被打断后，读者往往需要重新寻找位置。"},
            {"id": "p2", "text": "仅仅恢复滚动位置还不够，读者也需要重新建立前文思路。"},
            {"id": "p3", "text": "回顾中的引用必须能在输入段落里逐字找到。"},
        ],
    }
    interim = RecapInput.model_validate(raw)
    recap_input = interim.model_copy(update={"input_hash": compute_input_hash(interim)})
    provider = ZhihuProvider(
        access_secret=secret,
        model=os.environ.get("RECAP_MODEL", "zhida-fast-1p5"),
        summary_version="recap-v1",
        timeout_seconds=90,
    )
    try:
        result = await provider.generate(recap_input)
        validated = validate_recap_result(recap_input, result, "recap-v1")
    finally:
        await provider.close()
    if args.show_result:
        print(validated.model_dump_json(by_alias=True, indent=2))
    else:
        print(
            {
                "ok": True,
                "schemaVersion": validated.schema_version,
                "summaryVersion": validated.summary_version,
                "itemCount": len(validated.items),
                "allEvidenceValidated": True,
            }
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ProviderFailure as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": exc.code.value,
                    "message": exc.safe_message,
                    "requestId": exc.request_id,
                },
                ensure_ascii=False,
            )
        )
        raise SystemExit(1) from None
