"""Request and response of POST /api/v1/ai/developers/recommend (AI-02)."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .common import DESCRIPTION_MAX, MAX_SKILLS, SKILL_MAX, TITLE_MAX, StoryPoints, TaskType

SkillLevel = Literal["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]


class RecommendTask(BaseModel):
    title: str = Field(min_length=1, max_length=TITLE_MAX)
    description: str = Field(default="", max_length=DESCRIPTION_MAX)
    type: TaskType
    complexity: StoryPoints
    requiredSkills: list[str] = Field(default_factory=list, max_length=MAX_SKILLS)

    @field_validator("requiredSkills")
    @classmethod
    def skills_are_short(cls, values: list[str]) -> list[str]:
        if any(not value.strip() or len(value) > SKILL_MAX for value in values):
            raise ValueError(f"Each skill must be 1-{SKILL_MAX} characters")
        return values


class CandidateSkill(BaseModel):
    name: str = Field(min_length=1, max_length=SKILL_MAX)
    level: SkillLevel
    yearsOfExperience: float | None = Field(default=None, ge=0, le=60)


class Candidate(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    skills: list[CandidateSkill] = Field(default_factory=list, max_length=50)
    # Current workload: open tasks (not DONE) assigned to the developer, in every project.
    openTasks: int = Field(default=0, ge=0)
    openPoints: int = Field(default=0, ge=0)
    # Previous experience: DONE tasks, and how many of them required each skill.
    completedTasks: int = Field(default=0, ge=0)
    completedSkills: dict[str, int] = Field(default_factory=dict, max_length=300)


class RecommendOptions(BaseModel):
    # Story points a developer can carry at once (the sprint capacity by default).
    workloadCapacity: int = Field(default=20, ge=3, le=200)
    limit: int = Field(default=5, ge=1, le=20)


class RecommendRequest(BaseModel):
    task: RecommendTask
    candidates: list[Candidate] = Field(min_length=1, max_length=100)
    options: RecommendOptions = Field(default_factory=RecommendOptions)


class ScoreBreakdown(BaseModel):
    skills: float
    workload: float
    experience: float


class Recommendation(BaseModel):
    id: str
    score: int = Field(ge=0, le=100)
    matchingSkills: list[str]
    missingSkills: list[str]
    similarCompletedTasks: int
    breakdown: ScoreBreakdown
    explanation: str


class RecommendResponse(BaseModel):
    method: Literal["scoring"]
    model: str
    # required = the task's required skills; inferred = skills of the team named in the task text.
    skillsSource: Literal["required", "inferred", "none"]
    skills: list[str]
    recommendations: list[Recommendation]
    warnings: list[str]
