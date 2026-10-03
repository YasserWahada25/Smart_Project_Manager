"""TASK 20: configuration, health, error format, backend token."""

import pytest
from fastapi import APIRouter, Depends
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.security import require_backend_token


def test_health_says_which_analyzer_will_be_used(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "smart-project-manager-ai",
        "llm": {"provider": "openai", "configured": False, "model": None},
    }


def test_health_reports_a_configured_llm_without_the_key(client):
    client.app.dependency_overrides[get_settings] = lambda: Settings(
        ai_service_token="x" * 32, openai_api_key="sk-test-secret", openai_model="gpt-test"
    )

    body = client.get("/api/v1/health").json()

    assert body["llm"] == {"provider": "openai", "configured": True, "model": "gpt-test"}
    assert "sk-test-secret" not in str(body)


def test_unknown_route_uses_the_backend_error_format(client):
    response = client.get("/api/v1/nope")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"status": 404, "code": "NOT_FOUND", "message": "Route not found", "details": []}
    }


def test_settings_require_a_long_service_token():
    with pytest.raises(ValidationError):
        Settings(ai_service_token="too-short")


def test_blank_openai_key_means_no_llm():
    assert Settings(ai_service_token="x" * 32, openai_api_key="   ").llm_enabled is False
    assert Settings(ai_service_token="x" * 32, openai_api_key="sk-abc").llm_enabled is True


@pytest.fixture
def protected(client):
    router = APIRouter()

    @router.get("/api/v1/ai/protected", dependencies=[Depends(require_backend_token)])
    def protected_route():
        return {"ok": True}

    client.app.include_router(router)
    return client


def test_ai_routes_require_the_backend_token(protected, auth_headers):
    missing = protected.get("/api/v1/ai/protected")
    wrong = protected.get("/api/v1/ai/protected", headers={"X-AI-Service-Token": "wrong"})
    right = protected.get("/api/v1/ai/protected", headers=auth_headers)

    assert missing.status_code == 401
    assert missing.json()["error"]["message"] == "Invalid or missing service token"
    assert wrong.status_code == 401
    assert right.status_code == 200
