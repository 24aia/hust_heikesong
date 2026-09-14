# Recap API

Agent B owns this FastAPI service. It accepts a frozen `RecapInput`, verifies its
hash and size, runs a bounded asynchronous recap job, validates every citation,
and stores short-lived job state in SQLite.

## Local development

```powershell
cd apps/recap-api
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The default provider is deterministic `mock`. For a real request, set
`RECAP_PROVIDER=zhihu` and inject `ZHIHU_ACCESS_SECRET` into the process
environment. Never put the secret in this repository or a frontend response.

The create endpoint returns a one-task bearer token. It must be retained by the
extension service worker and sent only when polling or cancelling that task.
