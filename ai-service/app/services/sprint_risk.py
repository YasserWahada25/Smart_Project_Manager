"""AI-03 — delay risk of a sprint: the 7 features, the logistic regression and readable factors.

- probability < 0.35 → LOW, < 0.65 → MEDIUM, otherwise HIGH;
- factors: the features that push the risk up the most (contribution w × z > 0.25 in log-odds,
  at most 3; a MEDIUM or HIGH risk always names at least its main cause), described with the
  sprint's own numbers;
- obvious cases are decided by rule, without the model: no task (LOW), every point done (LOW),
  end date passed with points left (HIGH).
"""

from ..ml.sprint_features import FEATURES, SprintSnapshot, features
from ..ml.sprint_risk_model import MODEL_NAME, MODEL_VERSION, get_model
from ..schemas.risk import RiskFactor, RiskRequest, RiskResponse

LOW_BELOW, HIGH_FROM = 0.35, 0.65
MIN_IMPACT = 0.25
MAX_FACTORS = 3


def risk_level(probability: float) -> str:
    if probability < LOW_BELOW:
        return "LOW"
    return "MEDIUM" if probability < HIGH_FROM else "HIGH"


def snapshot_of(request: RiskRequest) -> SprintSnapshot:
    sprint, tasks, team = request.sprint, request.tasks, request.team
    duration = (sprint.endDate - sprint.startDate).days + 1
    elapsed = min(max((sprint.asOf - sprint.startDate).days, 0), duration)
    return SprintSnapshot(
        duration_days=duration,
        elapsed_days=float(elapsed),
        total_tasks=tasks.total,
        done_tasks=tasks.done,
        blocked_tasks=tasks.blocked,
        high_complexity_open=tasks.highComplexityOpen,
        unassigned_open=tasks.unassignedOpen,
        total_points=tasks.totalPoints,
        done_points=float(tasks.donePoints),
        team_size=team.size,
        historical_velocity=team.historicalVelocity,
    )


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}{'' if count == 1 else 's'}"


def _label(code: str, snap: SprintSnapshot, values: dict[str, float]) -> str | None:
    """Readable description of a factor, or None when it does not apply."""
    if code == "progress_gap":
        return (f"Behind schedule: {snap.elapsed_ratio:.0%} of the time elapsed, "
                f"{snap.done_ratio:.0%} of the story points done")
    if code == "pace_ratio":
        return (f"Needs {values[code]:.1f}× the usual pace: {snap.required_pace:.1f} points/day for "
                f"{snap.remaining_days:g} remaining days (usual {snap.usual_pace:.1f})")
    if code == "blocked_ratio" and snap.blocked_tasks:
        return f"{_plural(snap.blocked_tasks, 'blocked task')} ({values[code]:.0%} of the open tasks)"
    if code == "high_complexity_ratio" and snap.high_complexity_open:
        return f"{_plural(snap.high_complexity_open, 'open high-complexity task')} (8 points or more)"
    if code == "unassigned_ratio" and snap.unassigned_open:
        return f"{_plural(snap.unassigned_open, 'open task')} without assignee"
    if code == "load_per_member":
        return f"{values[code]:.1f} points per member and per day still needed (team of {snap.team_size})"
    if code == "elapsed_ratio":
        return f"Only {snap.remaining_days:g} days left"
    return None


def _model_info(metrics: dict) -> dict:
    return {
        "name": MODEL_NAME,
        "version": MODEL_VERSION,
        "accuracy": metrics["model"]["accuracy"],
        "rocAuc": metrics["model"]["roc_auc"],
        "f1": metrics["model"]["f1"],
    }


def predict_risk(request: RiskRequest) -> RiskResponse:
    model, metrics = get_model()
    snap = snapshot_of(request)
    row = features(snap)
    values = {name: round(value, 3) for name, value in zip(FEATURES, row)}
    info = _model_info(metrics)
    warnings: list[str] = []
    if snap.team_size == 0:
        warnings.append("The project has no active developer: the risk assumes a team of one.")
    if request.team.historicalVelocity is None:
        warnings.append("No completed sprint yet: the usual pace is estimated from this sprint.")

    def rule(level: str, probability: float, code: str, label: str) -> RiskResponse:
        factor = [RiskFactor(code=code, label=label, impact=0.0)] if label else []
        return RiskResponse(riskLevel=level, probability=probability, method="rule", factors=factor,
                            features=values, model=info, warnings=warnings)

    if snap.total_tasks == 0 or snap.total_points == 0:
        return rule("LOW", 0.0, "empty", "The sprint has no estimated task yet")
    if snap.remaining_points == 0:
        return rule("LOW", 0.0, "done", "Every story point of the sprint is done")
    if request.sprint.asOf > request.sprint.endDate:
        points = int(snap.remaining_points)
        return rule("HIGH", 1.0, "overdue", f"The end date is passed with {_plural(points, 'story point')} left")

    probability = model.predict_proba(row)
    contributions = sorted(zip(FEATURES, model.contributions(row)), key=lambda item: -item[1])
    factors = []
    for code, impact in contributions:
        if impact < MIN_IMPACT or len(factors) == MAX_FACTORS:
            break
        label = _label(code, snap, values)
        if label:
            factors.append(RiskFactor(code=code, label=label, impact=round(impact, 3)))
    if not factors and probability >= LOW_BELOW:
        # A medium or high risk always names at least its main cause.
        candidates = ((code, impact) for code, impact in contributions if impact > 0 and _label(code, snap, values))
        main = next(candidates, None)
        if main:
            factors.append(RiskFactor(code=main[0], label=_label(main[0], snap, values), impact=round(main[1], 3)))
    return RiskResponse(
        riskLevel=risk_level(probability),
        probability=round(probability, 3),
        method="model",
        factors=factors,
        features=values,
        model=info,
        warnings=warnings,
    )
