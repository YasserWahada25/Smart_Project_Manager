"""AI-04 — request / response of POST /api/v1/ai/assistant/chat and the arguments of each tool."""

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .common import (
    DESCRIPTION_MAX,
    MAX_SKILLS,
    SPRINT_NAME_MAX,
    SPRINT_OBJECTIVE_MAX,
    TITLE_MAX,
    Priority,
    StoryPoints,
    TaskType,
)

TaskStatus = Literal["TODO", "IN_PROGRESS", "CODE_REVIEW", "TESTING", "DONE", "BLOCKED"]
MESSAGE_MAX = 20_000  # tool results can be long JSON


class ToolCall(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=64)
    arguments: dict[str, Any] = Field(default_factory=dict)
    # Set by the AI service when the arguments do not match the tool schema.
    error: str | None = None
    # Provider data attached to the call, sent back unchanged on the next turn (Gemini "thought_signature").
    extra: dict[str, Any] | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "tool"]
    content: str = Field(default="", max_length=MESSAGE_MAX)
    toolCalls: list[ToolCall] = Field(default_factory=list, max_length=20)
    toolCallId: str | None = Field(default=None, max_length=100)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=80)
    # Small description of the project (name, status, dates, technologies…), added to the system prompt.
    project: dict[str, str | int | float | list[str] | None] = Field(default_factory=dict, max_length=20)
    today: date


class ChatResponse(BaseModel):
    # message = final answer to show; tool_calls = the backend must run the tools and call again.
    type: Literal["message", "tool_calls"]
    content: str
    toolCalls: list[ToolCall]
    model: str


# ---------- tool arguments (validated before the backend sees them) ----------
class _Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NoArgs(_Args):
    pass


class ListTasksArgs(_Args):
    status: TaskStatus | None = None
    sprintId: str | None = Field(default=None, max_length=50)
    assigneeId: str | None = Field(default=None, max_length=50)
    overdue: bool | None = None
    search: str | None = Field(default=None, max_length=100)


class SprintRef(_Args):
    sprintId: str = Field(min_length=1, max_length=50)


class TaskRef(_Args):
    taskId: str = Field(min_length=1, max_length=50)


class CreateTaskArgs(_Args):
    title: str = Field(min_length=1, max_length=TITLE_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    type: TaskType | None = None
    priority: Priority | None = None
    complexity: StoryPoints | None = None
    requiredSkills: list[str] | None = Field(default=None, max_length=MAX_SKILLS)
    sprintId: str | None = Field(default=None, max_length=50)
    assigneeId: str | None = Field(default=None, max_length=50)
    deadline: date | None = None


class UpdateTaskArgs(_Args):
    taskId: str = Field(min_length=1, max_length=50)
    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    type: TaskType | None = None
    priority: Priority | None = None
    complexity: StoryPoints | None = None
    requiredSkills: list[str] | None = Field(default=None, max_length=MAX_SKILLS)
    sprintId: str | None = Field(default=None, max_length=50)
    deadline: date | None = None


class AssignTaskArgs(_Args):
    taskId: str = Field(min_length=1, max_length=50)
    assigneeId: str | None = Field(default=None, max_length=50)


class ChangeStatusArgs(_Args):
    taskId: str = Field(min_length=1, max_length=50)
    status: TaskStatus
    blockedReason: str | None = Field(default=None, max_length=500)


class CreateSprintArgs(_Args):
    name: str = Field(min_length=1, max_length=SPRINT_NAME_MAX)
    objective: str | None = Field(default=None, max_length=SPRINT_OBJECTIVE_MAX)
    startDate: date
    endDate: date


TOOL_ARGUMENTS: dict[str, type[_Args]] = {
    "get_project_overview": NoArgs,
    "list_tasks": ListTasksArgs,
    "get_sprint_risk": SprintRef,
    "recommend_developers": TaskRef,
    "create_task": CreateTaskArgs,
    "update_task": UpdateTaskArgs,
    "assign_task": AssignTaskArgs,
    "change_task_status": ChangeStatusArgs,
    "create_sprint": CreateSprintArgs,
}
