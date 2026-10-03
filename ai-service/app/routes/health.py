from typing import Annotated

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..schemas.health import HealthResponse, LlmStatus

router = APIRouter(tags=["health"])


@router.get("/api/v1/health", response_model=HealthResponse)
def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Liveness + which analyzer will be used. Never returns secrets (only whether a key is set)."""
    return HealthResponse(
        status="ok",
        service="smart-project-manager-ai",
        llm=LlmStatus(
            provider="openai",
            configured=settings.llm_enabled,
            model=settings.openai_model if settings.llm_enabled else None,
        ),
    )
