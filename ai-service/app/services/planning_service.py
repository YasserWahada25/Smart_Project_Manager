"""AI-01 — plan of a project from its specification (hybrid).

1. Analysis: the LLM (OpenAI, Google Gemini… — any OpenAI-compatible API) when OPENAI_API_KEY is set
   (structured outputs), otherwise — or when the call fails — the local analyzer (requirement_parser +
   task_enricher). The answer says which one ran.
2. Planning: sprint_planner splits the tasks into sprints, the same way for both analyzers.
Nothing is stored: the backend shows the plan to the manager, who reviews it before creating anything.
"""

import logging

from pydantic import ValidationError

from ..config import Settings
from ..ml.text_classifier import normalize
from ..prompts.project_plan import MAX_LLM_TASKS, PLAN_SCHEMA, SYSTEM_PROMPT, build_user_prompt
from ..schemas.common import DESCRIPTION_MAX, MAX_SKILLS, MAX_TASKS, SKILL_MAX, TITLE_MAX
from ..schemas.llm import LlmPlan
from ..schemas.planning import PlannedTask, PlanRequest, PlanResponse, PlanStats
from .llm_client import LlmError, OpenAiClient
from .requirement_parser import DEFAULT_EPIC, EPIC_LIMIT, detect_language, parse_requirements
from .sprint_planner import plan_sprints
from .task_enricher import MAX_TASK_SKILLS, to_task

logger = logging.getLogger("ai-service")

LOCAL_MODEL = "local analyzer (rules + naive Bayes type classifier)"


def build_plan(request: PlanRequest, llm: OpenAiClient | None, settings: Settings) -> PlanResponse:
    warnings: list[str] = []
    language = detect_language(request.text)
    result = None
    if llm is not None:
        try:
            result = _analyze_with_llm(request, llm, settings.llm_max_document_chars, warnings)
            method, model = "llm", llm.model
        except LlmError as exc:
            logger.warning("LLM analysis failed (%s): local analyzer used", exc)
            warnings.append(f"{llm.label} could not analyse the document ({exc}): the local analyzer was used instead.")
    if result is None:
        result = _analyze_locally(request, language, warnings)
        method, model = "local", LOCAL_MODEL

    tasks, excluded = result
    sprints, backlog, planning_warnings = plan_sprints(
        tasks, request.options, language, request.project.deadline, excluded
    )
    warnings.extend(planning_warnings)
    all_tasks = [task for sprint in sprints for task in sprint.tasks] + backlog
    return PlanResponse(
        method=method,
        model=model,
        warnings=warnings,
        sprints=sprints,
        backlog=backlog,
        stats=PlanStats(
            taskCount=len(all_tasks),
            sprintCount=len(sprints),
            totalPoints=sum(sprint.totalPoints for sprint in sprints),
            epics=list(dict.fromkeys(task.epic for task in all_tasks)),
        ),
    )


def _analyze_locally(
    request: PlanRequest, language: str, warnings: list[str]
) -> tuple[list[PlannedTask], list[PlannedTask]]:
    parsed = parse_requirements(request.text)  # ApiError 422 when nothing is found
    warnings.extend(parsed.warnings)
    tasks: list[PlannedTask] = []
    excluded: list[PlannedTask] = []
    for requirement in parsed.requirements:
        task = to_task(requirement, language, request.project.technologies, request.teamSkills)
        (excluded if requirement.excluded else tasks).append(task)
    return tasks, excluded


def _analyze_with_llm(
    request: PlanRequest, llm: OpenAiClient, max_chars: int, warnings: list[str]
) -> tuple[list[PlannedTask], list[PlannedTask]]:
    document = request.text
    if len(document) > max_chars:
        document = document[:max_chars]
        warnings.append(f"The document is long: only its first {max_chars} characters were sent to {llm.label}.")
    project = request.project
    answer = llm.complete_json(
        SYSTEM_PROMPT,
        build_user_prompt(document, project.name, project.description, project.technologies, request.teamSkills),
        "project_plan",
        PLAN_SCHEMA,
    )
    try:
        plan = LlmPlan.model_validate(answer)
    except ValidationError as exc:
        logger.warning("Invalid LLM answer: %s", exc.errors()[:3])
        raise LlmError("the answer does not match the expected schema") from None
    return _tasks_from_llm(plan, warnings, llm.label)


def _tasks_from_llm(
    plan: LlmPlan, warnings: list[str], label: str = "The LLM"
) -> tuple[list[PlannedTask], list[PlannedTask]]:
    """The schema is valid: cut what is too long, drop empty or duplicate tasks."""
    tasks: list[PlannedTask] = []
    excluded: list[PlannedTask] = []
    seen: set[str] = set()
    for epic in plan.epics:
        epic_name = _clip(epic.name, EPIC_LIMIT) or DEFAULT_EPIC
        for item in epic.tasks:
            title = _clip(item.title, TITLE_MAX)
            key = normalize(title)
            if not title or key in seen:
                continue
            seen.add(key)
            # Unique ignoring case: the backend refuses "Angular" and "angular" in the same task.
            skills: list[str] = []
            for skill in item.requiredSkills:
                skill = _clip(skill, SKILL_MAX)
                if skill and normalize(skill) not in {normalize(known) for known in skills}:
                    skills.append(skill)
            task = PlannedTask(
                title=title,
                description=item.description.strip()[:DESCRIPTION_MAX],
                type=item.type,
                priority=item.priority,
                complexity=item.complexity,
                requiredSkills=skills[: min(MAX_TASK_SKILLS, MAX_SKILLS)],
                epic=epic_name,
            )
            (excluded if item.excluded else tasks).append(task)
    total = len(tasks) + len(excluded)
    if total == 0:
        raise LlmError("the answer contains no task")
    limit = min(MAX_TASKS, MAX_LLM_TASKS)
    if total > limit:
        warnings.append(f"{label} proposed {total} tasks: only the first {limit} are kept.")
        tasks = tasks[:limit]
        excluded = excluded[: max(limit - len(tasks), 0)]
    return tasks, excluded


def _clip(value: str, limit: int) -> str:
    return " ".join(value.split())[:limit].strip()
