from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings
from app.jobs.repository import JobRepository
from app.jobs.service import JobService
from app.providers import MockProvider, Provider, ZhihuProvider
from app.rate_limit import MinuteRateLimiter
from app.models.contracts import AppError, AppErrorCode
from app.routes.recap_jobs import ApiException, router as recap_jobs_router


def create_app(settings: Settings | None = None, provider: Provider | None = None) -> FastAPI:
    configured = settings or Settings.from_env()
    selected_provider = provider or _build_provider(configured)
    repository = JobRepository(configured.db_path)
    service = JobService(
        repository=repository,
        provider=selected_provider,
        summary_version=configured.summary_version,
        ttl_seconds=configured.job_ttl_seconds,
        max_concurrency=configured.max_concurrency,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await service.start()
        try:
            yield
        finally:
            await service.stop()

    app = FastAPI(title="Liukanshan Recap API", version="0.1.0", lifespan=lifespan)
    app.state.settings = configured
    app.state.job_service = service
    app.state.rate_limiter = MinuteRateLimiter(configured.requests_per_minute)
    app.include_router(recap_jobs_router)

    @app.exception_handler(ApiException)
    async def handle_api_exception(_: Request, exc: ApiException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.error.model_dump(by_alias=True, mode="json", exclude_none=True),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(_: Request, __: RequestValidationError) -> JSONResponse:
        error = AppError(
            code=AppErrorCode.MODEL_OUTPUT_INVALID,
            message="请求格式不符合 RecapInput v1 契约。",
        )
        return JSONResponse(
            status_code=422,
            content=error.model_dump(by_alias=True, mode="json"),
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/v1/capabilities")
    async def capabilities() -> dict[str, object]:
        return {
            "schemaVersion": 1,
            "summaryVersion": configured.summary_version,
            "inputLimitCodePoints": configured.input_limit_code_points,
            "provider": configured.provider,
        }

    return app


def _build_provider(settings: Settings) -> Provider:
    if settings.provider == "mock":
        return MockProvider(settings.summary_version)
    if settings.provider == "zhihu":
        if not settings.access_secret:
            raise RuntimeError("ZHIHU_ACCESS_SECRET is required for the zhihu provider")
        return ZhihuProvider(
            access_secret=settings.access_secret,
            model=settings.model,
            summary_version=settings.summary_version,
            timeout_seconds=settings.provider_timeout_seconds,
        )
    raise RuntimeError(f"unsupported RECAP_PROVIDER: {settings.provider}")


app = create_app()
