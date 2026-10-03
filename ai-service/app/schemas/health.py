from typing import Literal

from pydantic import BaseModel


class LlmStatus(BaseModel):
    # openai, gemini, groq, ollama or custom (detected from OPENAI_BASE_URL).
    provider: str
    configured: bool
    model: str | None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    llm: LlmStatus
