"""Configuration read from the environment (or `ai-service/.env`), validated at startup."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_TOKEN_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Shared secret sent by the Express backend in the `X-AI-Service-Token` header.
    ai_service_token: str = Field(min_length=MIN_TOKEN_LENGTH)

    # LLM (optional): without a key, the local analyzer is used.
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
    def llm_enabled(self) -> bool:
        return self.openai_api_key is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
