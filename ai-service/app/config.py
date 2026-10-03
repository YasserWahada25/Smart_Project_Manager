"""Configuration read from the environment (or `ai-service/.env`), validated at startup."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_TOKEN_LENGTH = 32

# OpenAI-compatible Chat Completions providers, recognised from OPENAI_BASE_URL: (host part, code, label).
LLM_PROVIDERS = (
    ("api.openai.com", "openai", "OpenAI"),
    ("generativelanguage.googleapis.com", "gemini", "Google Gemini"),
    ("api.groq.com", "groq", "Groq"),
    (":11434", "ollama", "Ollama"),
)


def detect_provider(base_url: str) -> tuple[str, str]:
    """(code, label) of the provider behind an OpenAI-compatible base URL."""
    for host, code, label in LLM_PROVIDERS:
        if host in base_url:
            return code, label
    return "custom", "the LLM provider"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Shared secret sent by the Express backend in the `X-AI-Service-Token` header.
    ai_service_token: str = Field(min_length=MIN_TOKEN_LENGTH)

    # LLM (optional): any OpenAI-compatible Chat Completions API (OpenAI, Google Gemini, Groq, Ollama…).
    # Without a key, the local analyzer is used and the assistant is unavailable.
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    llm_timeout_seconds: float = Field(default=60.0, gt=0, le=300)
    # Longer documents are truncated before being sent to the LLM (cost and context limits).
    llm_max_document_chars: int = Field(default=30_000, ge=1_000, le=200_000)

    # Uploaded specification documents.
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    max_document_chars: int = Field(default=100_000, ge=1_000)

    log_level: str = "INFO"

    @field_validator("openai_api_key")
    @classmethod
    def blank_key_means_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None

    @property
    def llm_provider(self) -> tuple[str, str]:
        return detect_provider(self.openai_base_url)

    @property
    def llm_enabled(self) -> bool:
        return self.openai_api_key is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
