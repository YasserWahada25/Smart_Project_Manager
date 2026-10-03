"""Request and response of POST /api/v1/ai/projects/plan (camelCase, like the backend)."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .common import (
    DESCRIPTION_MAX,
    MAX_SKILLS,
    SKILL_MAX,
    SPRINT_NAME_MAX,
    SPRINT_OBJECTIVE_MAX,
    TITLE_MAX,
    Priority,
    StoryPoints,
    TaskType,
)


class ProjectContext(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    technologies: list[str] = Field(default_factory=list, max_length=30)
    deadline: date | None = None


class PlanOptions(BaseModel):
    startDate: date
    sprintLengthDays: int = Field(default=14, ge=5, le=30)
    # Story points the team can deliver in one sprint.
    capacityPerSprint: int = Field(default=20, ge=3, le=200)


class PlanRequest(BaseModel):
    text: str = Field(min_length=20, max_length=200_000)
    project: ProjectContext
    options: PlanOptions
    # Skills of the team members: helps tagging the tasks with known skills.
    teamSkills: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if len(value.strip()) < 20:
            raise ValueError("The document must contain at least 20 characters")
        return value


class PlannedTask(BaseModel):
    title: str = Field(min_length=1, max_length=TITLE_MAX)
    description: str = Field(default="", max_length=DESCRIPTION_MAX)
    type: TaskType
    priority: Priority
    complexity: StoryPoints
    requiredSkills: list[str] = Field(default_factory=list, max_length=MAX_SKILLS)
    # Section of the document (epic / module) the task comes from.
    epic: str = Field(default="General", max_length=100)

    @field_validator("requiredSkills")
    @classmethod
    def skills_are_short(cls, values: list[str]) -> list[str]:
        if any(not value or len(value) > SKILL_MAX for value in values):
            raise ValueError(f"Each skill must be 1-{SKILL_MAX} characters")
        return values


class PlannedSprint(BaseModel):
    name: str = Field(min_length=1, max_length=SPRINT_NAME_MAX)
    objective: str = Field(default="", max_length=SPRINT_OBJECTIVE_MAX)
    startDate: date
    endDate: date
    totalPoints: int
    tasks: list[PlannedTask]

    @model_validator(mode="after")
    def dates_in_order(self) -> "PlannedSprint":
        if self.endDate < self.startDate:
            raise ValueError("endDate must be on or after startDate")
        return self


class PlanStats(BaseModel):
    taskCount: int
    sprintCount: int
    totalPoints: int
    epics: list[str]


class PlanResponse(BaseModel):
    # llm = OpenAI analysed the document; local = local analyzer (rules + ML classifier).
    method: Literal["llm", "local"]
    model: str
    warnings: list[str]
    sprints: list[PlannedSprint]
    # Tasks that did not fit in the sprints (capacity / maximum number of sprints).
    backlog: list[PlannedTask]
    stats: PlanStats
