from __future__ import annotations

from app.hashing import compute_input_hash, input_code_points


def test_hash_is_stable_and_ignores_mode(recap_input):
    bridge = recap_input.model_copy(update={"mode": "bridge"})
    assert compute_input_hash(recap_input) == recap_input.input_hash
    assert compute_input_hash(bridge) == recap_input.input_hash


def test_code_point_count_matches_contract(recap_input):
    assert input_code_points(recap_input) == sum(
        len(paragraph.text) for paragraph in recap_input.paragraphs
    )
