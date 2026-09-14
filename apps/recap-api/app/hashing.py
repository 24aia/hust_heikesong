from __future__ import annotations

import hashlib
import json

from app.models.contracts import RecapInput


def canonical_input_payload(recap_input: RecapInput) -> list[object]:
    return [
        1,
        recap_input.content_key,
        recap_input.cutoff.policy,
        recap_input.coverage,
        [[paragraph.id, paragraph.text] for paragraph in recap_input.paragraphs],
    ]


def compute_input_hash(recap_input: RecapInput) -> str:
    encoded = json.dumps(
        canonical_input_payload(recap_input),
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def input_code_points(recap_input: RecapInput) -> int:
    return sum(len(paragraph.text) for paragraph in recap_input.paragraphs)
