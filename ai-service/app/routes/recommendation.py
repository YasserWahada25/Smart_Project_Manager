"""AI-02 route, called by the Express backend only (X-AI-Service-Token)."""

from fastapi import APIRouter, Depends

from ..schemas.recommendation import RecommendRequest, RecommendResponse
from ..security import require_backend_token
from ..services.developer_scoring import recommend

router = APIRouter(prefix="/api/v1/ai", tags=["recommendation"], dependencies=[Depends(require_backend_token)])


@router.post("/developers/recommend", response_model=RecommendResponse)
def recommend_developers(request: RecommendRequest) -> RecommendResponse:
    """Project members ranked for a task (skills, workload, experience). Nothing is stored."""
    return recommend(request)
