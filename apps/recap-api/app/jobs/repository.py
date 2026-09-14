from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import sqlite3
import threading
import time

from app.models.contracts import AppError, RecapInput, RecapResult


TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}


@dataclass(frozen=True)
class JobRecord:
    job_id: str
    token_hash: str
    status: str
    recap_input: RecapInput
    result: RecapResult | None
    error: AppError | None
    created_at: float
    updated_at: float
    expires_at: float
    cancel_requested: bool


class JobRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS recap_jobs (
                    job_id TEXT PRIMARY KEY,
                    token_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_json TEXT NOT NULL,
                    result_json TEXT,
                    error_json TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    cancel_requested INTEGER NOT NULL DEFAULT 0
                )
                """
            )

    def create(
        self,
        job_id: str,
        token_hash: str,
        recap_input: RecapInput,
        expires_at: float,
    ) -> None:
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO recap_jobs (
                    job_id, token_hash, status, input_json, created_at,
                    updated_at, expires_at, cancel_requested
                ) VALUES (?, ?, 'queued', ?, ?, ?, ?, 0)
                """,
                (
                    job_id,
                    token_hash,
                    recap_input.model_dump_json(by_alias=True),
                    now,
                    now,
                    expires_at,
                ),
            )

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM recap_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
        return self._decode(row) if row else None

    def set_running(self, job_id: str) -> bool:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE recap_jobs SET status = 'running', updated_at = ?
                WHERE job_id = ? AND status = 'queued' AND cancel_requested = 0
                """,
                (time.time(), job_id),
            )
            return cursor.rowcount == 1

    def set_succeeded(self, job_id: str, result: RecapResult) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE recap_jobs
                SET status = 'succeeded', result_json = ?, error_json = NULL,
                    updated_at = ?
                WHERE job_id = ? AND status = 'running' AND cancel_requested = 0
                """,
                (result.model_dump_json(by_alias=True), time.time(), job_id),
            )

    def set_failed(self, job_id: str, error: AppError) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE recap_jobs
                SET status = 'failed', error_json = ?, updated_at = ?
                WHERE job_id = ? AND status NOT IN ('succeeded', 'cancelled')
                """,
                (error.model_dump_json(by_alias=True), time.time(), job_id),
            )

    def request_cancel(self, job_id: str, error: AppError) -> bool:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE recap_jobs
                SET cancel_requested = 1, status = 'cancelled', error_json = ?,
                    updated_at = ?
                WHERE job_id = ? AND status NOT IN ('succeeded', 'failed', 'cancelled')
                """,
                (error.model_dump_json(by_alias=True), time.time(), job_id),
            )
            return cursor.rowcount == 1

    def mark_unfinished_interrupted(self, error: AppError) -> int:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE recap_jobs
                SET status = 'failed', error_json = ?, updated_at = ?
                WHERE status IN ('queued', 'running')
                """,
                (error.model_dump_json(by_alias=True), time.time()),
            )
            return cursor.rowcount

    def purge_expired(self) -> int:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM recap_jobs WHERE expires_at < ?", (time.time(),)
            )
            return cursor.rowcount

    @staticmethod
    def _decode(row: sqlite3.Row) -> JobRecord:
        result_raw = json.loads(row["result_json"]) if row["result_json"] else None
        error_raw = json.loads(row["error_json"]) if row["error_json"] else None
        return JobRecord(
            job_id=row["job_id"],
            token_hash=row["token_hash"],
            status=row["status"],
            recap_input=RecapInput.model_validate_json(row["input_json"]),
            result=RecapResult.model_validate(result_raw) if result_raw else None,
            error=AppError.model_validate(error_raw) if error_raw else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            expires_at=row["expires_at"],
            cancel_requested=bool(row["cancel_requested"]),
        )
