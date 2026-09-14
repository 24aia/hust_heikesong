from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: "".join(
            word if index == 0 else word.capitalize()
            for index, word in enumerate(value.split("_"))
        ),
        populate_by_name=True,
        extra="forbid",
    )


class RecapMode(StrEnum):
    BRIEF = "brief"
    BRIDGE = "bridge"


class AnchorKind(StrEnum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"


class Paragraph(ContractModel):
    id: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1)

    @field_validator("text")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("paragraph text cannot be blank")
        return value


class Cutoff(ContractModel):
    anchor_kind: AnchorKind
    policy: Literal["before-paragraph"]


class RecapInput(ContractModel):
    schema_version: Literal[1]
    content_key: str = Field(min_length=1, max_length=300)
    title: str = Field(min_length=1, max_length=1000)
    source_url: HttpUrl
    input_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    mode: RecapMode
    cutoff: Cutoff
    coverage: Literal["prefix-to-cutoff", "partial-prefix"]
    paragraphs: list[Paragraph]

    @field_validator("paragraphs")
    @classmethod
    def paragraph_ids_are_unique(cls, value: list[Paragraph]) -> list[Paragraph]:
        ids = [paragraph.id for paragraph in value]
        if len(ids) != len(set(ids)):
            raise ValueError("paragraph ids must be unique")
        return value


class Evidence(ContractModel):
    paragraph_id: str = Field(min_length=1)
    quote: str = Field(min_length=1)


class RecapItem(ContractModel):
    text: str = Field(min_length=1)
    evidence: list[Evidence] = Field(min_length=1)


class Bridge(ContractModel):
    text: str = Field(min_length=1)
    evidence: list[Evidence] = Field(min_length=1)


class RecapResult(ContractModel):
    schema_version: Literal[1]
    input_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    summary_version: str = Field(min_length=1)
    items: list[RecapItem]
    bridge: Bridge | None
    warnings: list[str]


class AppErrorCode(StrEnum):
    UNSUPPORTED_PAGE = "UNSUPPORTED_PAGE"
    CONTENT_NOT_READY = "CONTENT_NOT_READY"
    ANCHOR_NOT_FOUND = "ANCHOR_NOT_FOUND"
    INPUT_TOO_LARGE = "INPUT_TOO_LARGE"
    INPUT_INSUFFICIENT = "INPUT_INSUFFICIENT"
    NETWORK_ERROR = "NETWORK_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    MODEL_OUTPUT_INVALID = "MODEL_OUTPUT_INVALID"
    JOB_INTERRUPTED = "JOB_INTERRUPTED"
    CANCELLED = "CANCELLED"


class AppError(ContractModel):
    code: AppErrorCode
    message: str
    request_id: str | None = None
