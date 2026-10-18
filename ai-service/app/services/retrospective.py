"""AI-05 — retrospective of a completed sprint.

The metrics are always computed here, by code. The text (summary, delivered, slipped, blockers, what went well,
what to improve, actions) is written by the LLM from these facts when a key is configured; without a key, or when
the LLM fails, it is built by rules from the same facts (`method: "local"`), so a retrospective is always produced.
"""

import logging
import re

from pydantic import ValidationError

from ..prompts.retrospective import MAX_TOKENS, RETRO_SCHEMA, SYSTEM_PROMPT, build_user_prompt
from ..schemas.retrospective import (
    ACTION_DESCRIPTION_MAX,
    ACTION_TITLE_MAX,
    ITEM_MAX,
    MAX_ACTIONS,
    MAX_ITEMS,
    MAX_OPINIONS,
    SUMMARY_MAX,
    LlmRetrospective,
    RetroAction,
    RetroMetrics,
    RetroRequest,
    RetroResponse,
    RetroTask,
)
from .llm_client import LlmError, OpenAiClient

logger = logging.getLogger("ai-service")

PRIORITY_WEIGHTS = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
STATUS_LABELS = {
    "TODO": "to do",
    "IN_PROGRESS": "in progress",
    "CODE_REVIEW": "in code review",
    "TESTING": "in testing",
    "DONE": "done",
    "BLOCKED": "blocked",
}
GOOD_COMPLETION = 0.9
LOW_COMPLETION = 0.8
VELOCITY_CHANGE = 0.1  # ±10 % is considered a real change
SCOPE_GROWTH = 0.2  # share of the points added after the start
WORKLOAD_SHARE = 0.5  # one member carrying more than half of the assigned points (team of 3 or more)


def build_retrospective(request: RetroRequest, llm: OpenAiClient | None) -> RetroResponse:
    metrics = compute_metrics(request)
    warnings: list[str] = []
    if metrics.totalTasks == 0:
        warnings.append("The sprint had no task: there is little to review.")
    if metrics.historicalVelocity is None:
        warnings.append("No previous completed sprint: the velocity cannot be compared.")

    local = _local_text(request, metrics)
    if llm is not None and metrics.totalTasks > 0:
        try:
            text = _llm_text(request, metrics, llm)
            if not text["actions"]:
                text["actions"] = local["actions"]
            return RetroResponse(method="llm", model=llm.model, metrics=metrics, warnings=warnings, **text)
        except LlmError as exc:
            logger.warning("Retrospective: LLM failed (%s), local rules used", exc)
            warnings.append(f"{llm.label} could not write the retrospective ({exc}): it was built from the sprint "
                            "figures instead.")
    return RetroResponse(method="local", model=None, metrics=metrics, warnings=warnings, **local)


# ---------------------------------------------------------------- metrics
def compute_metrics(request: RetroRequest) -> RetroMetrics:
    tasks = request.tasks
    done = [task for task in tasks if task.status == "DONE"]
    total_points = sum(task.points for task in tasks)
    done_points = sum(task.points for task in done)
    if total_points:
        completion = done_points / total_points
    else:
        completion = len(done) / len(tasks) if tasks else 0.0
    duration = (request.sprint.endDate - request.sprint.startDate).days + 1
    velocity = round(done_points / duration, 2)
    history = request.historicalVelocity
    change = round(velocity / history - 1, 3) if history else None
    return RetroMetrics(
        totalTasks=len(tasks),
        doneTasks=len(done),
        totalPoints=total_points,
        donePoints=done_points,
        completionRate=round(completion, 3),
        durationDays=duration,
        velocity=velocity,
        historicalVelocity=history,
        velocityChange=change,
        blockedTasks=sum(task.status == "BLOCKED" for task in tasks),
        blockedDuringSprint=sum(task.wasBlocked or task.status == "BLOCKED" for task in tasks),
        addedAfterStart=sum(task.addedAfterStart for task in tasks),
        lateTasks=sum(task.late for task in tasks),
        unassignedOpen=sum(task.status != "DONE" and not task.assignee for task in tasks),
    )


# ---------------------------------------------------------------- LLM
FRENCH_MARKERS = re.compile(
    r"[éèêàçùûôî]|\b(le|la|les|des|du|de|et|une|un|pour|avec|sur|par|en)\b", re.IGNORECASE
)
ENGLISH_MARKERS = re.compile(r"\b(the|of|and|a|an|for|with|on|by|to|in)\b", re.IGNORECASE)


def detect_language(texts: list[str]) -> str:
    """French or English, from the words of the task titles and the objective (the model is told which one)."""
    text = " ".join(texts)
    return "French" if len(FRENCH_MARKERS.findall(text)) > len(ENGLISH_MARKERS.findall(text)) else "English"


def _facts(request: RetroRequest, m: RetroMetrics) -> dict:
    """Facts for the model: explicit names and ready-made percentages (a ratio like 0.448 is misread as 448 %)."""
    sprint = request.sprint
    change = None if m.velocityChange is None else round(m.velocityChange * 100)
    return {
        "language": detect_language([task.title for task in request.tasks] + [sprint.objective]),
        "sprint": {
            "name": sprint.name,
            "objective": sprint.objective or None,
            "startDate": sprint.startDate.isoformat(),
            "endDate": sprint.endDate.isoformat(),
            "durationDays": m.durationDays,
        },
        "figures": {
            "tasksTotal": m.totalTasks,
            "tasksDone": m.doneTasks,
            "tasksNotFinished": m.totalTasks - m.doneTasks,
            "storyPointsCommitted": m.totalPoints,
            "storyPointsDelivered": m.donePoints,
            "storyPointsDeliveredPercent": round(m.completionRate * 100),
            "velocityPointsPerDay": m.velocity,
            "previousSprintsVelocityPointsPerDay": m.historicalVelocity,
            "velocityChangePercent": change,
            "tasksBlockedAtTheEnd": m.blockedTasks,
            "tasksBlockedAtSomePoint": m.blockedDuringSprint,
            "tasksAddedAfterTheStart": m.addedAfterStart,
            "tasksLate": m.lateTasks,
            "tasksNotFinishedWithoutAssignee": m.unassignedOpen,
        },
        "tasks": [task.model_dump(exclude_defaults=True) for task in request.tasks],
        "team": [member.model_dump() for member in request.team],
    }


def _llm_text(request: RetroRequest, metrics: RetroMetrics, llm: OpenAiClient) -> dict:
    answer = llm.complete_json(
        SYSTEM_PROMPT, build_user_prompt(_facts(request, metrics)), "sprint_retrospective", RETRO_SCHEMA,
        max_tokens=MAX_TOKENS,
    )
    try:
        retro = LlmRetrospective.model_validate(answer)
    except ValidationError as exc:
        logger.warning("Invalid retrospective answer: %s", exc.errors()[:3])
        raise LlmError("the answer does not match the expected schema") from None
    summary = _clip(retro.summary, SUMMARY_MAX)
    if not summary:
        raise LlmError("the answer has no summary")
    actions = []
    for action in retro.actions:
        title = _clip(action.title, ACTION_TITLE_MAX)
        if title and title.lower() not in {known.title.lower() for known in actions}:
            actions.append(RetroAction(title=title, description=_clip(action.description, ACTION_DESCRIPTION_MAX),
                                       type=action.type, priority=action.priority))
    return {
        "summary": summary,
        "delivered": _items(retro.delivered, MAX_ITEMS),
        "slipped": _items(retro.slipped, MAX_ITEMS),
        "blockers": _items(retro.blockers, MAX_ITEMS),
        "wentWell": _items(retro.wentWell, MAX_OPINIONS),
        "toImprove": _items(retro.toImprove, MAX_OPINIONS),
        "actions": actions[:MAX_ACTIONS],
    }


# ---------------------------------------------------------------- local rules
def _points(value: int) -> str:
    return f"{value} point" if value == 1 else f"{value} points"


def _tasks(value: int) -> str:
    return f"{value} task" if value == 1 else f"{value} tasks"


def _was(count: int) -> str:
    return "was" if count == 1 else "were"


def _is(count: int) -> str:
    return "is" if count == 1 else "are"


def _its(count: int) -> str:
    return "its" if count == 1 else "their"


def _percent(value: float) -> str:
    return f"{round(value * 100)}%"


def _task_label(task: RetroTask) -> str:
    who = f", {task.assignee}" if task.assignee else ""
    return f"«{task.title}» ({_points(task.points)}{who})"


def _local_text(request: RetroRequest, m: RetroMetrics) -> dict:
    tasks = request.tasks
    done = sorted((t for t in tasks if t.status == "DONE"), key=lambda t: -t.points)
    open_ = sorted((t for t in tasks if t.status != "DONE"),
                   key=lambda t: (-PRIORITY_WEIGHTS[t.priority], -t.points))
    open_points = m.totalPoints - m.donePoints
    blocked = [t for t in tasks if t.status == "BLOCKED" or t.wasBlocked]
    added = [t for t in tasks if t.addedAfterStart]
    added_points = sum(t.points for t in added)
    important = [t for t in tasks if t.priority in ("CRITICAL", "HIGH")]
    heavy = _workload_imbalance(request)

    # Summary
    if m.totalTasks == 0:
        summary = f"{request.sprint.name} had no task."
    else:
        summary = (f"{request.sprint.name}: {m.doneTasks} of {_tasks(m.totalTasks)} done "
                   f"({m.donePoints} of {_points(m.totalPoints)}, {_percent(m.completionRate)}).")
        if m.velocityChange is not None:
            trend = "up" if m.velocityChange >= 0 else "down"
            summary += (f" Velocity {m.velocity} points/day, {trend} {abs(round(m.velocityChange * 100))}% "
                        f"compared with the previous sprints.")
        else:
            summary += f" Velocity {m.velocity} points/day."
        if open_:
            summary += f" {_tasks(len(open_)).capitalize()} ({_points(open_points)}) {_was(len(open_))} not finished."
        elif m.blockedDuringSprint:
            summary += (f" {_tasks(m.blockedDuringSprint).capitalize()} {_was(m.blockedDuringSprint)} blocked during "
                        "the sprint.")

    delivered = [_task_label(t) for t in done[:MAX_ITEMS]]
    if len(done) > MAX_ITEMS:
        delivered[-1] = f"{_tasks(len(done) - MAX_ITEMS + 1).capitalize()} more"
    slipped = []
    for task in open_[:MAX_ITEMS]:
        reason = f": {task.blockedReason}" if task.status == "BLOCKED" and task.blockedReason else ""
        slipped.append(f"«{task.title}» — {STATUS_LABELS[task.status]}{reason}")

    blockers = []
    for task in [t for t in blocked if t.status == "BLOCKED"][:3]:
        blockers.append(f"«{task.title}» is blocked" + (f": {task.blockedReason}" if task.blockedReason else ""))
    unblocked = sum(1 for t in blocked if t.status != "BLOCKED")
    if unblocked:
        blockers.append(f"{_tasks(unblocked).capitalize()} {_was(unblocked)} blocked during the sprint, then unblocked")
    if added:
        blockers.append(f"{_tasks(len(added)).capitalize()} ({_points(added_points)}) {_was(len(added))} added after "
                        "the start")
    if m.lateTasks:
        blockers.append(f"{_tasks(m.lateTasks).capitalize()} finished after {_its(m.lateTasks)} deadline or "
                        f"{_is(m.lateTasks)} overdue")
    if m.unassignedOpen:
        blockers.append(f"{_tasks(m.unassignedOpen).capitalize()} not finished had no assignee")
    if heavy:
        blockers.append(f"{heavy[0]} carried {_percent(heavy[1])} of the assigned story points")

    went_well, to_improve, actions = [], [], []
    if m.totalTasks:
        if m.completionRate >= GOOD_COMPLETION:
            went_well.append(f"{_percent(m.completionRate)} of the committed story points were delivered")
        if m.velocityChange is not None and m.velocityChange >= VELOCITY_CHANGE:
            went_well.append(f"Velocity up {round(m.velocityChange * 100)}% compared with the previous sprints")
        if not m.blockedDuringSprint:
            went_well.append("No task was blocked during the sprint")
        if important and all(t.status == "DONE" for t in important):
            went_well.append("All the high-priority tasks were delivered")
        if not m.lateTasks:
            went_well.append("No task finished late")

    if open_ and m.completionRate < LOW_COMPLETION:
        to_improve.append(f"Only {_percent(m.completionRate)} of the committed story points were delivered")
        actions.append(RetroAction(
            title=f"Re-plan the {_tasks(len(open_))} not finished",
            description=f"{_tasks(len(open_)).capitalize()} ({_points(open_points)}) {_was(len(open_))} not "
                        "finished: move them to the next sprint or back to the backlog, and re-estimate them.",
            type="IMPROVEMENT", priority="HIGH"))
    slower = bool(m.totalTasks) and m.velocityChange is not None and m.velocityChange <= -VELOCITY_CHANGE
    if m.donePoints and (slower or (open_ and m.completionRate < LOW_COMPLETION)):
        pace = min(m.velocity, m.historicalVelocity) if m.historicalVelocity else m.velocity
        target = round(pace * m.durationDays)
        if slower:
            to_improve.append(f"Velocity down {abs(round(m.velocityChange * 100))}% compared with the previous "
                              "sprints")
        actions.append(RetroAction(
            title=f"Commit to about {_points(target)} in the next sprint",
            description=f"The team delivered {m.velocity} points/day "
                        f"({m.donePoints} points in {m.durationDays} days): plan the next sprint at this pace.",
            type="IMPROVEMENT", priority="MEDIUM"))
    if blocked:
        to_improve.append(f"{_tasks(len(blocked)).capitalize()} {_was(len(blocked))} blocked during the sprint")
        reasons = [t.blockedReason for t in blocked if t.blockedReason][:3]
        actions.append(RetroAction(
            title="Review the causes of the blocked tasks with the team",
            description=f"{_tasks(len(blocked)).capitalize()} {_was(len(blocked))} blocked"
                        + (f" ({'; '.join(reasons)})" if reasons else "")
                        + ": remove these causes before the next sprint.",
            type="IMPROVEMENT", priority="HIGH"))
    if added and m.totalPoints and added_points / m.totalPoints > SCOPE_GROWTH:
        to_improve.append(f"The scope grew during the sprint: {_points(added_points)} added after the start")
        actions.append(RetroAction(
            title="Freeze the sprint scope once it has started",
            description=f"{_points(added_points).capitalize()} ({_percent(added_points / m.totalPoints)} of the "
                        f"sprint) {_was(added_points)} added after the start: put new work in the backlog instead.",
            type="IMPROVEMENT", priority="MEDIUM"))
    if m.lateTasks:
        to_improve.append(f"{_tasks(m.lateTasks).capitalize()} finished late or {_is(m.lateTasks)} overdue")
        actions.append(RetroAction(
            title="Check the deadlines of the next sprint's tasks",
            description=f"{_tasks(m.lateTasks).capitalize()} missed {_its(m.lateTasks)} deadline: make sure each "
                        "deadline fits inside the sprint and its estimate.",
            type="IMPROVEMENT", priority="MEDIUM"))
    if m.unassignedOpen:
        to_improve.append(f"{_tasks(m.unassignedOpen).capitalize()} not finished had no assignee")
        actions.append(RetroAction(
            title="Assign every task before the sprint starts",
            description=f"{_tasks(m.unassignedOpen).capitalize()} stayed unassigned and {_was(m.unassignedOpen)} "
                        "not finished.",
            type="IMPROVEMENT", priority="MEDIUM"))
    if heavy:
        to_improve.append(f"Unbalanced workload: {heavy[0]} carried {_percent(heavy[1])} of the assigned points")
        actions.append(RetroAction(
            title="Balance the workload across the team",
            description=f"{heavy[0]} carried {_percent(heavy[1])} of the assigned story points: share the next "
                        "tasks more evenly (Recommend a developer helps).",
            type="IMPROVEMENT", priority="MEDIUM"))
    if not actions and m.totalTasks:
        actions.append(RetroAction(
            title="Keep the same commitment level in the next sprint",
            description=f"The sprint delivered {_percent(m.completionRate)} of its story points "
                        f"({m.velocity} points/day): plan the next one at the same pace.",
            type="IMPROVEMENT", priority="LOW"))

    return {
        "summary": summary,
        "delivered": delivered,
        "slipped": slipped,
        "blockers": blockers[:MAX_ITEMS],
        "wentWell": went_well[:MAX_OPINIONS],
        "toImprove": to_improve[:MAX_OPINIONS],
        "actions": actions[:MAX_ACTIONS],
    }


def _workload_imbalance(request: RetroRequest) -> tuple[str, float] | None:
    """(name, share) of the member carrying more than half of the assigned points, in a team of 3 or more."""
    loads = [(member.name, member.donePoints + member.openPoints) for member in request.team]
    loads = [(name, load) for name, load in loads if load > 0]
    total = sum(load for _, load in loads)
    if len(request.team) < 3 or not total:
        return None
    name, load = max(loads, key=lambda item: item[1])
    share = load / total
    return (name, share) if share > WORKLOAD_SHARE else None


def _clip(value: str, limit: int) -> str:
    return " ".join(value.split())[:limit].strip()


def _items(values: list[str], limit: int) -> list[str]:
    items = []
    for value in values:
        text = _clip(value, ITEM_MAX)
        if text and text not in items:
            items.append(text)
    return items[:limit]
