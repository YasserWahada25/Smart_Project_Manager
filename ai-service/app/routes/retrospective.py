"""AI-05 route, called by the Express backend only (X-AI-Service-Token)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..schemas.retrospective import RetroRequest, RetroResponse
from ..security import require_backend_token
from ..services.llm_client import OpenAiClient, get_llm_client
from ..services.retrospective import build_retrospective

router = APIRouter(prefix="/api/v1/ai", tags=["retrospective"], dependencies=[Depends(require_backend_token)])


@router.post("/sprints/retrospective", response_model=RetroResponse)
def sprint_retrospective(
    request: RetroRequest, llm: Annotated[OpenAiClient | None, Depends(get_llm_client)]
) -> RetroResponse:
    """Retrospective of a completed sprint (LLM, or rules without a key). Nothing is stored."""
    return build_retrospective(request, llm)
