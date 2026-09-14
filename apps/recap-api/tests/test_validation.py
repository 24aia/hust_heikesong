from __future__ import annotations

import pytest

from app.models.contracts import Evidence, RecapItem, RecapResult
from app.validation.result import ResultValidationError, validate_recap_result


def test_rejects_quote_not_in_source(recap_input):
    result = RecapResult(
        schema_version=1,
        input_hash=recap_input.input_hash,
        summary_version="untrusted",
        items=[
            RecapItem(
                text="一个看似合理但无证据的结论",
                evidence=[Evidence(paragraph_id="p1", quote="原文里不存在")],
            )
        ],
        bridge=None,
        warnings=[],
    )
    with pytest.raises(ResultValidationError, match="quote"):
        validate_recap_result(recap_input, result, "recap-v1")


def test_server_controls_summary_version(recap_input):
    quote = recap_input.paragraphs[0].text[:8]
    result = RecapResult(
        schema_version=1,
        input_hash=recap_input.input_hash,
        summary_version="model-value",
        items=[
            RecapItem(
                text="阅读可能被打断",
                evidence=[Evidence(paragraph_id="p1", quote=quote)],
            )
        ],
        bridge=None,
        warnings=[],
    )
    validated = validate_recap_result(recap_input, result, "recap-v1")
    assert validated.summary_version == "recap-v1"
