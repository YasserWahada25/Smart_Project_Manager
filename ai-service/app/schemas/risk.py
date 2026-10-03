"""Request and response of POST /api/v1/ai/sprints/predict-risk (AI-03)."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class RiskSprint(BaseModel):
    startDate: date
    endDate: date
    # Day of the prediction (today for the backend).
    asOf: date

    @model_validator(mode="after")
    def dates_in_order(self) -> "RiskSprint":
        if self.endDate < self.startDate:
            raise ValueError("endDate must be on or after startDate")
        return self


class RiskTasks(BaseModel):
    total: int = Field(ge=0, le=10_000)
    done: int = Field(ge=0)
    blocked: int = Field(ge=0)
    highComplexityOpen: int = Field(ge=0)
    unassignedOpen: int = Field(ge=0)
    totalPoints: int = Field(ge=0, le=1_000_000)
    donePoints: int = Field(ge=0)

    @model_validator(mode="after")
    def counts_are_consistent(self) -> "RiskTasks":
        open_tasks = self.total - self.done
        if self.done > self.total or self.donePoints > self.totalPoints:
            raise ValueError("done values cannot exceed the totals")
        if max(self.blocked, self.highComplexityOpen, self.unassignedOpen) > open_tasks:
            raise ValueError("blocked, high-complexity and unassigned tasks must be open tasks")
        return self


class RiskTeam(BaseModel):
    size: int = Field(ge=0, le=500)
    # Story points per day delivered by the team in its previous sprints (None: unknown).
    historicalVelocity: float | None = Field(default=None, ge=0, le=10_000)


class RiskRequest(BaseModel):
    sprint: RiskSprint
    tasks: RiskTasks
    team: RiskTeam


class RiskFactor(BaseModel):
    code: str
    label: str
    # Contribution to the log-odds of a delay (higher = more responsible for the risk).
    impact: float


class RiskResponse(BaseModel):
    riskLevel: Literal["LOW", "MEDIUM", "HIGH"]
    probability: float = Field(ge=0, le=1)
    # model = logistic regression; rule = obvious case decided without the model (no task, all done, end passed).
    method: Literal["model", "rule"]
    factors: list[RiskFactor]
    features: dict[str, float]
    model: dict
    warnings: list[str]
