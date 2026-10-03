"""Test configuration: a random service token, no LLM key (the local analyzer is the default), OpenAI URL."""

import os
import secrets

# Set before the application is imported: the settings are validated at startup.
TEST_TOKEN = secrets.token_hex(32)
os.environ["AI_SERVICE_TOKEN"] = TEST_TOKEN
os.environ["OPENAI_API_KEY"] = ""
# Independent of the developer's ai-service/.env (which may point to another provider).
os.environ["OPENAI_BASE_URL"] = "https://api.openai.com/v1"
os.environ["OPENAI_MODEL"] = "gpt-4o-mini"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture
def client():
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.fixture
def auth_headers():
    return {"X-AI-Service-Token": TEST_TOKEN}


@pytest.fixture(autouse=True)
def no_retry_pause(monkeypatch):
    """Transient LLM errors are retried after a pause in production: no pause in the tests."""
    from app.services import llm_client

    monkeypatch.setattr(llm_client, "RETRY_DELAY_SECONDS", 0)
