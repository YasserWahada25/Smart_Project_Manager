"""AI-03 route, called by the Express backend only (X-AI-Service-Token)."""

from fastapi import APIRouter, Depends

from ..schemas.risk import RiskRequest, RiskResponse
from ..security import require_backend_token
from ..services.sprint_risk import predict_risk

router = APIRouter(prefix="/api/v1/ai", tags=["risk"], dependencies=[Depends(require_backend_token)])


@router.post("/sprints/predict-risk", response_model=RiskResponse)
def predict_sprint_risk(request: RiskRequest) -> RiskResponse:
    """Delay risk of a sprint (LOW / MEDIUM / HIGH), its probability and main factors. Nothing is stored."""
    return predict_risk(request)
