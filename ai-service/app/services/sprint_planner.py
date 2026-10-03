"""Deterministic split of the tasks into sprints (used after the LLM and after the local analyzer).

- order: priority (CRITICAL → LOW), then the order of the document;
- packing: each task goes into the first sprint that still has room for its story points, but never
  before a sprint that holds a task of higher priority (gaps are filled by tasks of the same level);
- a task larger than the capacity gets a sprint of its own (warning: split it);
- at most MAX_SPRINTS sprints; the remaining tasks and the "Won't have" tasks stay in the backlog;
- sprint i runs from startDate + i × sprintLengthDays for sprintLengthDays days; its objective
  lists the epics it delivers.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

from ..schemas.common import MAX_SPRINTS, SPRINT_OBJECTIVE_MAX
from ..schemas.planning import PlannedSprint, PlannedTask, PlanOptions

PRIORITY_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


@dataclass
class _Sprint:
    tasks: list[PlannedTask] = field(default_factory=list)
    points: int = 0


def plan_sprints(
    tasks: list[PlannedTask],
    options: PlanOptions,
    language: str = "en",
    deadline: date | None = None,
    excluded: list[PlannedTask] | None = None,
) -> tuple[list[PlannedSprint], list[PlannedTask], list[str]]:
    """(sprints, backlog, warnings)."""
    capacity = options.capacityPerSprint
    ordered = sorted(enumerate(tasks), key=lambda item: (PRIORITY_RANK[item[1].priority], item[0]))
    sprints: list[_Sprint] = []
    backlog: list[PlannedTask] = []
    warnings: list[str] = []
    floor = 0  # first sprint a task of the current priority may use
    current_rank = None

    for _, task in ordered:
        rank = PRIORITY_RANK[task.priority]
        if rank != current_rank:
            # Higher-priority tasks are all placed: this level starts where they end.
            floor = max(len(sprints) - 1, 0)
            current_rank = rank
        if task.complexity > capacity:
            warnings.append(
                f"“{task.title}” ({task.complexity} pts) is larger than the capacity of a sprint ({capacity} pts): "
                "consider splitting it."
            )
        target = next(
            (index for index in range(floor, len(sprints)) if sprints[index].points + task.complexity <= capacity),
            None,
        )
        if target is None:
            if len(sprints) >= MAX_SPRINTS:
                backlog.append(task)
                continue
            sprints.append(_Sprint())
            target = len(sprints) - 1
        sprints[target].tasks.append(task)
        sprints[target].points += task.complexity

    if backlog:
        warnings.append(
            f"{len(backlog)} task(s) did not fit in {MAX_SPRINTS} sprints and stay in the backlog: "
            "increase the capacity per sprint or the sprint length."
        )
    backlog.extend(excluded or [])

    planned = [_to_sprint(index, sprint, options, language) for index, sprint in enumerate(sprints)]
    if deadline and planned and planned[-1].endDate > deadline:
        warnings.append(
            f"The last sprint ends on {planned[-1].endDate.isoformat()}, after the project deadline "
            f"({deadline.isoformat()}): increase the capacity, or move tasks to the backlog."
        )
    return planned, backlog, warnings


def _to_sprint(index: int, sprint: _Sprint, options: PlanOptions, language: str) -> PlannedSprint:
    start = options.startDate + timedelta(days=index * options.sprintLengthDays)
    epics = list(dict.fromkeys(task.epic for task in sprint.tasks))
    label = "Livrer" if language == "fr" else "Deliver"
    objective = f"{label} : {', '.join(epics)}" if language == "fr" else f"{label}: {', '.join(epics)}"
    if len(objective) > SPRINT_OBJECTIVE_MAX:
        objective = objective[: SPRINT_OBJECTIVE_MAX - 1].rsplit(",", 1)[0] + "…"
    return PlannedSprint(
        name=f"Sprint {index + 1}",
        objective=objective,
        startDate=start,
        endDate=start + timedelta(days=options.sprintLengthDays - 1),
        totalPoints=sprint.points,
        tasks=sprint.tasks,
    )
