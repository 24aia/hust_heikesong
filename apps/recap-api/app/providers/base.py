from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.contracts import AppErrorCode, RecapInput, RecapResult


class ProviderFailure(RuntimeError):
    def __init__(self, code: AppErrorCode, message: str, request_id: str | None = None):
        super().__init__(message)
        self.code = code
        self.safe_message = message
        self.request_id = request_id


class Provider(ABC):
    @abstractmethod
    async def generate(self, recap_input: RecapInput) -> RecapResult:
        raise NotImplementedError

    async def close(self) -> None:
        return None
