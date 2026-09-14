from __future__ import annotations

from app.jobs.repository import JobRepository
from app.models.contracts import AppError, AppErrorCode


def test_restart_marks_unfinished_jobs_interrupted(tmp_path, recap_input):
    repository = JobRepository(tmp_path / "restart.db")
    repository.create("job-1", "token-hash", recap_input, 9_999_999_999)
    changed = repository.mark_unfinished_interrupted(
        AppError(code=AppErrorCode.JOB_INTERRUPTED, message="interrupted")
    )
    record = repository.get("job-1")
    assert changed == 1
    assert record is not None
    assert record.status == "failed"
    assert record.error is not None
    assert record.error.code == AppErrorCode.JOB_INTERRUPTED
