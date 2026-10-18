"""Request and response of POST /api/v1/ai/sprints/retrospective (AI-05), and the answer expected from the LLM."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .common import SPRINT_NAME_MAX, SPRINT_OBJECTIVE_MAX, TITLE_MAX, Priority, TaskType

TaskStatus = Literal["TODO", "IN_PROGRESS", "CODE_REVIEW", "TESTING", "DONE", "BLOCKED"]

# Limits of the retrospective (also checked by the backend).
MAX_ITEMS = 6  # delivered, slipped, blockers
MAX_OPINIONS = 5  # wentWell, toImprove
MAX_ACTIONS = 5
ITEM_MAX = 300
SUMMARY_MAX = 1200
ACTION_TITLE_MAX = 120
ACTION_DESCRIPTION_MAX = 500


class RetroSprint(BaseModel):
    name: str = Field(min_length=1, max_length=SPRINT_NAME_MAX)
    objective: str = Field(default="", max_length=SPRINT_OBJECTIVE_MAX)
    startDate: date
    endDate: date

    @model_validator(mode="after")
    def dates_in_order(self) -> "RetroSprint":
        if self.endDate < self.startDate:
            raise ValueError("endDate must be on or after startDate")
        return self


class RetroTask(BaseModel):
    title: str = Field(min_length=1, max_length=TITLE_MAX)
    type: TaskType
    priority: Priority
    points: int = Field(ge=0, le=13)
    status: TaskStatus
    assignee: str | None = Field(default=None, max_length=101)
    blockedReason: str | None = Field(default=None, max_length=500)
    # Blocked at some point during the sprint (from the history), even if unblocked since.
    wasBlocked: bool = False
    # Created in the sprint after its start date (scope change).
    addedAfterStart: bool = False
    # Finished after its deadline, or still open with its deadline passed.
    late: bool = False


class RetroMember(BaseModel):
    name: str = Field(min_length=1, max_length=101)
    donePoints: int = Field(ge=0, le=100_000)
    openPoints: int = Field(ge=0, le=100_000)


class RetroRequest(BaseModel):
    sprint: RetroSprint
    tasks: list[RetroTask] = Field(max_length=300)
    team: list[RetroMember] = Field(default_factory=list, max_length=100)
    # Story points per day of the previous completed sprints (None: no previous sprint).
    historicalVelocity: float | None = Field(default=None, ge=0, le=10_000)


class RetroAction(BaseModel):
    title: str
    description: str
    type: TaskType
    priority: Priority


class RetroMetrics(BaseModel):
    """Computed by code from the request (never by the LLM)."""

    totalTasks: int
    doneTasks: int
    totalPoints: int
    donePoints: int
    # Share of the committed story points delivered (of the tasks when no task is estimated), 0–1.
    completionRate: float
    durationDays: int
    velocity: float
    historicalVelocity: float | None
    # velocity ÷ historical velocity − 1 (None without history).
    velocityChange: float | None
    blockedTasks: int
    blockedDuringSprint: int
    addedAfterStart: int
    lateTasks: int
    unassignedOpen: int


class RetroResponse(BaseModel):
    method: Literal["llm", "local"]
    model: str | None
    summary: str
    delivered: list[str]
    slipped: list[str]
    blockers: list[str]
    wentWell: list[str]
    toImprove: list[str]
    actions: list[RetroAction]
    metrics: RetroMetrics
    warnings: list[str]


class LlmRetrospective(BaseModel):
    """Answer of the LLM (prompts/retrospective.py RETRO_SCHEMA). Lengths and counts are cut afterwards."""

    model_config = ConfigDict(extra="forbid")

    summary: str
    delivered: list[str]
    slipped: list[str]
    blockers: list[str]
    wentWell: list[str]
    toImprove: list[str]
    actions: list["LlmAction"]


class LlmAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    type: TaskType
    priority: Priority


LlmRetrospective.model_rebuild()
