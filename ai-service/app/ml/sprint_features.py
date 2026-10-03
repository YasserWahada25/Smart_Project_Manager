"""AI-03 — features of a sprint at a given day, shared by the dataset simulator and the prediction service.

Raw values (what the backend can measure) → 7 features describing how late the sprint is and why.
"""

from dataclasses import dataclass

FEATURES = (
    "elapsed_ratio",  # share of the sprint duration already elapsed
    "progress_gap",  # elapsed ratio − share of the story points done (> 0 = behind schedule)
    "pace_ratio",  # points/day still needed ÷ usual pace of the team (capped at 5)
    "blocked_ratio",  # blocked tasks ÷ open tasks
    "high_complexity_ratio",  # open tasks of 8+ points ÷ open tasks
    "unassigned_ratio",  # open tasks without assignee ÷ open tasks
    "load_per_member",  # points per member per remaining day still needed (capped at 5)
)
MAX_RATIO = 5.0
MIN_REMAINING_DAYS = 0.5
MIN_PACE = 0.1


@dataclass(frozen=True)
class SprintSnapshot:
    duration_days: int
    elapsed_days: float
    total_tasks: int
    done_tasks: int
    blocked_tasks: int
    high_complexity_open: int
    unassigned_open: int
    total_points: int
    done_points: float
    team_size: int
    # Points per day of the team in its previous sprints (None when unknown).
    historical_velocity: float | None

    @property
    def open_tasks(self) -> int:
        return max(self.total_tasks - self.done_tasks, 0)

    @property
    def remaining_points(self) -> float:
        return max(self.total_points - self.done_points, 0.0)

    @property
    def remaining_days(self) -> float:
        return max(self.duration_days - self.elapsed_days, MIN_REMAINING_DAYS)

    @property
    def done_ratio(self) -> float:
        return self.done_points / self.total_points if self.total_points else 1.0

    @property
    def elapsed_ratio(self) -> float:
        return min(max(self.elapsed_days / self.duration_days, 0.0), 1.0)

    @property
    def usual_pace(self) -> float:
        """Historical velocity, else the pace of this sprint so far, else the planned pace."""
        if self.historical_velocity:
            return self.historical_velocity
        if self.elapsed_days >= 1 and self.done_points > 0:
            return self.done_points / self.elapsed_days
        return self.total_points / self.duration_days

    @property
    def required_pace(self) -> float:
        return self.remaining_points / self.remaining_days


def _share(count: int, total: int) -> float:
    return count / total if total else 0.0


def features(snapshot: SprintSnapshot) -> list[float]:
    open_tasks = snapshot.open_tasks
    return [
        snapshot.elapsed_ratio,
        snapshot.elapsed_ratio - snapshot.done_ratio,
        min(snapshot.required_pace / max(snapshot.usual_pace, MIN_PACE), MAX_RATIO),
        _share(snapshot.blocked_tasks, open_tasks),
        _share(snapshot.high_complexity_open, open_tasks),
        _share(snapshot.unassigned_open, open_tasks),
        min(snapshot.remaining_points / max(snapshot.team_size, 1) / snapshot.remaining_days, MAX_RATIO),
    ]
