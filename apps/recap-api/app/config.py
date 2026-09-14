from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    provider: str
    model: str
    access_secret: str | None
    db_path: Path
    job_ttl_seconds: int
    max_concurrency: int
    requests_per_minute: int
    provider_timeout_seconds: float
    summary_version: str = "recap-v1"
    input_limit_code_points: int = 20_000

    @classmethod
    def from_env(cls) -> "Settings":
        secret = os.getenv("ZHIHU_ACCESS_SECRET", "").strip()
        return cls(
            provider=os.getenv("RECAP_PROVIDER", "mock").strip().lower(),
            model=os.getenv("RECAP_MODEL", "zhida-fast-1p5").strip(),
            access_secret=secret or None,
            db_path=Path(os.getenv("RECAP_DB_PATH", "recap-jobs.db")),
            job_ttl_seconds=int(os.getenv("RECAP_JOB_TTL_SECONDS", "86400")),
            max_concurrency=max(1, int(os.getenv("RECAP_MAX_CONCURRENCY", "2"))),
            requests_per_minute=max(
                1, int(os.getenv("RECAP_REQUESTS_PER_MINUTE", "30"))
            ),
            provider_timeout_seconds=float(
                os.getenv("RECAP_PROVIDER_TIMEOUT_SECONDS", "90")
            ),
        )
