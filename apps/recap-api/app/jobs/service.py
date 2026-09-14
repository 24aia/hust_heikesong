from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
import time
import uuid

from app.jobs.repository import JobRecord, JobRepository
from app.models.contracts import AppError, AppErrorCode, RecapInput
from app.providers.base import Provider, ProviderFailure
from app.validation.result import ResultValidationError, validate_recap_result


class JobService:
    def __init__(
        self,
        repository: JobRepository,
        provider: Provider,
        summary_version: str,
        ttl_seconds: int,
        max_concurrency: int,
    ) -> None:
        self.repository = repository
        self.provider = provider
        self.summary_version = summary_version
        self.ttl_seconds = ttl_seconds
        self.max_concurrency = max_concurrency
        self._queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=100)
        self._workers: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        self.repository.purge_expired()
        self.repository.mark_unfinished_interrupted(
            AppError(
                code=AppErrorCode.JOB_INTERRUPTED,
                message="服务重启，未完成的任务已中断。",
            )
        )
        self._workers = [
            asyncio.create_task(self._worker(), name=f"recap-worker-{index}")
            for index in range(self.max_concurrency)
        ]

    async def stop(self) -> None:
        for _ in self._workers:
            await self._queue.put(None)
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        await self.provider.close()

    async def create(self, recap_input: RecapInput) -> tuple[str, str]:
        job_id = str(uuid.uuid4())
        access_token = secrets.token_urlsafe(32)
        self.repository.create(
            job_id=job_id,
            token_hash=_hash_token(access_token),
            recap_input=recap_input,
            expires_at=time.time() + self.ttl_seconds,
        )
        try:
            self._queue.put_nowait(job_id)
        except asyncio.QueueFull as exc:
            self.repository.set_failed(
                job_id,
                AppError(
                    code=AppErrorCode.RATE_LIMITED,
                    message="总结任务队列已满，请稍后重试。",
                ),
            )
            raise RuntimeError("job queue is full") from exc
        return job_id, access_token

    def authorized_job(self, job_id: str, access_token: str) -> JobRecord | None:
        record = self.repository.get(job_id)
        if record is None:
            return None
        if not hmac.compare_digest(record.token_hash, _hash_token(access_token)):
            return None
        if record.expires_at < time.time():
            return None
        return record

    def cancel(self, job_id: str) -> bool:
        return self.repository.request_cancel(
            job_id,
            AppError(code=AppErrorCode.CANCELLED, message="任务已取消。"),
        )

    async def _worker(self) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                if job_id is None:
                    return
                record = self.repository.get(job_id)
                if record is None or record.cancel_requested:
                    continue
                if not self.repository.set_running(job_id):
                    continue
                try:
                    result = await self.provider.generate(record.recap_input)
                    result = validate_recap_result(
                        record.recap_input, result, self.summary_version
                    )
                    self.repository.set_succeeded(job_id, result)
                except ProviderFailure as exc:
                    self.repository.set_failed(
                        job_id,
                        AppError(
                            code=exc.code,
                            message=exc.safe_message,
                            request_id=exc.request_id,
                        ),
                    )
                except (ResultValidationError, ValueError) as exc:
                    self.repository.set_failed(
                        job_id,
                        AppError(
                            code=AppErrorCode.MODEL_OUTPUT_INVALID,
                            message="模型结果中的引用或结构无效。",
                        ),
                    )
                except Exception:
                    self.repository.set_failed(
                        job_id,
                        AppError(
                            code=AppErrorCode.NETWORK_ERROR,
                            message="总结任务执行失败。",
                        ),
                    )
            finally:
                self._queue.task_done()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
