from typing import Literal

from pydantic import BaseModel


class LlmStatus(BaseModel):
    provider: Literal["openai"]
    configured: bool
    model: str | None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    llm: LlmStatus
