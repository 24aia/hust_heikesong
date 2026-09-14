from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, ConfigDict

from app.hashing import compute_input_hash, input_code_points
from app.jobs.service import JobService
from app.models.contracts import AppError, AppErrorCode, RecapInput, RecapResult


router = APIRouter(prefix="/api/v1/recap-jobs", tags=["recap-jobs"])


def _camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=lambda value: _camel(value), populate_by_name=True)


class JobCreated(ApiModel):
    job_id: str
    job_access_token: str
    status: Literal["queued"] = "queued"


class JobView(ApiModel):
    job_id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    result: RecapResult | None = None
    error: AppError | None = None
    updated_at: float


class CancelView(ApiModel):
    job_id: str
    status: Literal["cancelled", "unchanged"]


class ApiException(Exception):
    def __init__(self, status_code: int, error: AppError) -> None:
        self.status_code = status_code
        self.error = error


@router.post("", response_model=JobCreated, status_code=status.HTTP_202_ACCEPTED)
async def create_recap_job(recap_input: RecapInput, request: Request) -> JobCreated:
    settings = request.app.state.settings
    limiter = request.app.state.rate_limiter
    client_key = request.client.host if request.client else "unknown"
    if not limiter.allow(client_key):
        raise ApiException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            AppError(code=AppErrorCode.RATE_LIMITED, message="请求过于频繁。"),
        )
    if not recap_input.paragraphs:
        raise ApiException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            AppError(
                code=AppErrorCode.INPUT_INSUFFICIENT,
                message="断点之前没有足够的文本可供回顾。",
            ),
        )
    if input_code_points(recap_input) > settings.input_limit_code_points:
        raise ApiException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            AppError(
                code=AppErrorCode.INPUT_TOO_LARGE,
                message=f"输入超过 {settings.input_limit_code_points} 个 Unicode 码点。",
            ),
        )
    if compute_input_hash(recap_input) != recap_input.input_hash:
        raise ApiException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            AppError(
                code=AppErrorCode.MODEL_OUTPUT_INVALID,
                message="inputHash 与前文快照不匹配。",
            ),
        )
    service: JobService = request.app.state.job_service
    try:
        job_id, token = await service.create(recap_input)
    except RuntimeError:
        raise ApiException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            AppError(
                code=AppErrorCode.RATE_LIMITED,
                message="总结任务队列已满，请稍后重试。",
            ),
        ) from None
    return JobCreated(job_id=job_id, job_access_token=token)


@router.get("/{job_id}", response_model=JobView)
async def get_recap_job(job_id: str, request: Request) -> JobView:
    record = _authorized_record(job_id, request)
    return JobView(
        job_id=record.job_id,
        status=record.status,
        result=record.result,
        error=record.error,
        updated_at=record.updated_at,
    )


@router.delete("/{job_id}", response_model=CancelView)
async def cancel_recap_job(job_id: str, request: Request) -> CancelView:
    record = _authorized_record(job_id, request)
    service: JobService = request.app.state.job_service
    changed = service.cancel(record.job_id)
    return CancelView(job_id=record.job_id, status="cancelled" if changed else "unchanged")


def _authorized_record(job_id: str, request: Request):
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _not_found()
    service: JobService = request.app.state.job_service
    record = service.authorized_job(job_id, token)
    if record is None:
        raise _not_found()
    return record


def _not_found() -> ApiException:
    return ApiException(
        status.HTTP_404_NOT_FOUND,
        AppError(code=AppErrorCode.ANCHOR_NOT_FOUND, message="任务不存在或凭证无效。"),
    )
