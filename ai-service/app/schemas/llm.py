"""Answer expected from the LLM (prompts/project_plan.py PLAN_SCHEMA), validated before any use.

Lengths are not limited here: too long texts are cut by the planning service, while a wrong type,
priority or complexity value makes the whole answer invalid.
"""

from pydantic import BaseModel, ConfigDict

from .common import Priority, StoryPoints, TaskType


class LlmTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    type: TaskType
    priority: Priority
    complexity: StoryPoints
    requiredSkills: list[str]
    excluded: bool


class LlmEpic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    tasks: list[LlmTask]


class LlmPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    epics: list[LlmEpic]
