from __future__ import annotations

from app.models.contracts import RecapInput, RecapMode, RecapResult


class ResultValidationError(ValueError):
    pass


def validate_recap_result(
    recap_input: RecapInput,
    result: RecapResult,
    summary_version: str,
) -> RecapResult:
    if result.input_hash != recap_input.input_hash:
        raise ResultValidationError("model returned a mismatched inputHash")

    paragraphs = {paragraph.id: paragraph.text for paragraph in recap_input.paragraphs}
    evidence_groups = [item.evidence for item in result.items]
    if result.bridge is not None:
        evidence_groups.append(result.bridge.evidence)

    if not result.items:
        raise ResultValidationError("result must contain at least one recap item")
    if recap_input.mode is RecapMode.BRIDGE and result.bridge is None:
        raise ResultValidationError("bridge mode requires a bridge result")
    if recap_input.mode is RecapMode.BRIEF and result.bridge is not None:
        raise ResultValidationError("brief mode must not return a bridge")

    for group in evidence_groups:
        if not group:
            raise ResultValidationError("each result section needs evidence")
        for evidence in group:
            paragraph = paragraphs.get(evidence.paragraph_id)
            if paragraph is None:
                raise ResultValidationError(
                    f"unknown evidence paragraph: {evidence.paragraph_id}"
                )
            if evidence.quote not in paragraph:
                raise ResultValidationError(
                    f"evidence quote is not in paragraph: {evidence.paragraph_id}"
                )

    return result.model_copy(update={"summary_version": summary_version})
