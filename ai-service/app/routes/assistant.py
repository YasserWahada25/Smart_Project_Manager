"""AI-04 route, called by the Express backend only (X-AI-Service-Token)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..errors import ApiError
from ..schemas.assistant import ChatRequest, ChatResponse
from ..security import require_backend_token
from ..services.assistant import chat
from ..services.llm_client import OpenAiClient, get_llm_client

router = APIRouter(prefix="/api/v1/ai", tags=["assistant"], dependencies=[Depends(require_backend_token)])


@router.post("/assistant/chat", response_model=ChatResponse)
def assistant_chat(
    request: ChatRequest, llm: Annotated[OpenAiClient | None, Depends(get_llm_client)]
) -> ChatResponse:
    """One turn of the manager assistant: the answer, or the tool calls the backend must run."""
    if llm is None:
        raise ApiError(503, "The assistant needs an OpenAI API key (OPENAI_API_KEY)", code="LLM_NOT_CONFIGURED")
    return chat(request, llm)
