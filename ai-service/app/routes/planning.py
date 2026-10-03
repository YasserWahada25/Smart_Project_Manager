"""AI-01 routes, called by the Express backend only (X-AI-Service-Token)."""

from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile
from starlette.concurrency import run_in_threadpool

from ..config import Settings, get_settings
from ..errors import ApiError
from ..schemas.documents import ExtractResponse
from ..schemas.planning import PlanRequest, PlanResponse
from ..security import require_backend_token
from ..services.llm_client import OpenAiClient, get_llm_client
from ..services.planning_service import build_plan
from ..services.text_extraction import extract_text

router = APIRouter(prefix="/api/v1/ai", tags=["planning"], dependencies=[Depends(require_backend_token)])


@router.post("/documents/extract", response_model=ExtractResponse)
async def extract_document(file: UploadFile, settings: Annotated[Settings, Depends(get_settings)]) -> ExtractResponse:
    """Text of a specification file (.txt, .md, .pdf, .docx), multipart field `file`."""
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise ApiError(413, f"The file exceeds {settings.max_upload_bytes // (1024 * 1024)} MB")
    filename = file.filename or ""
    # PDF / Word parsing is CPU-bound: keep the event loop free.
    text, truncated = await run_in_threadpool(extract_text, filename, content, settings.max_document_chars)
    return ExtractResponse(filename=filename, text=text, characters=len(text), truncated=truncated)


@router.post("/projects/plan", response_model=PlanResponse)
def plan_project(
    request: PlanRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    llm: Annotated[OpenAiClient | None, Depends(get_llm_client)],
) -> PlanResponse:
    """Sprints and tasks proposed from the specification text. Nothing is stored."""
    return build_plan(request, llm, settings)
