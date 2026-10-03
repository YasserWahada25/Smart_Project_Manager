"""Values shared with the Express backend (models/task.model.js)."""

from typing import Literal

TaskType = Literal["FEATURE", "BUG", "IMPROVEMENT", "TESTING", "DOCUMENTATION", "DEVOPS", "SECURITY"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
StoryPoints = Literal[1, 2, 3, 5, 8, 13]

TASK_TYPES: tuple[str, ...] = ("FEATURE", "BUG", "IMPROVEMENT", "TESTING", "DOCUMENTATION", "DEVOPS", "SECURITY")
PRIORITIES: tuple[str, ...] = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
STORY_POINTS: tuple[int, ...] = (1, 2, 3, 5, 8, 13)

# Backend limits (TASK_LIMITS / SPRINT_LIMITS).
TITLE_MAX = 200
DESCRIPTION_MAX = 5000
MAX_SKILLS = 20
SKILL_MAX = 50
SPRINT_NAME_MAX = 100
SPRINT_OBJECTIVE_MAX = 1000
MAX_TASKS = 100
MAX_SPRINTS = 20
