from datetime import date

from app.schemas.planning import PlannedTask, PlanOptions
from app.services.sprint_planner import plan_sprints


def task(title, priority="MEDIUM", points=3, epic="General"):
    return PlannedTask(title=title, type="FEATURE", priority=priority, complexity=points, epic=epic)


def options(capacity=10, length=14):
    return PlanOptions(startDate=date(2026, 10, 5), sprintLengthDays=length, capacityPerSprint=capacity)


def titles(sprint):
    return [planned.title for planned in sprint.tasks]


def test_tasks_are_packed_by_priority_within_the_capacity():
    tasks = [task("A", "LOW", 5), task("B", "HIGH", 5), task("C", "MEDIUM", 8), task("D", "HIGH", 3)]
    sprints, backlog, warnings = plan_sprints(tasks, options(capacity=10))
    assert [titles(sprint) for sprint in sprints] == [["B", "D"], ["C"], ["A"]]
    assert [sprint.totalPoints for sprint in sprints] == [8, 8, 5]
    assert backlog == [] and warnings == []


def test_small_tasks_of_the_same_priority_fill_the_gaps():
    tasks = [task("A", points=8), task("B", points=5), task("C", points=2)]
    sprints, _, _ = plan_sprints(tasks, options(capacity=10))
    assert [titles(sprint) for sprint in sprints] == [["A", "C"], ["B"]]


def test_a_lower_priority_never_goes_before_a_higher_one():
    tasks = [task("A", "HIGH", 8), task("B", "HIGH", 8), task("C", "LOW", 1)]
    sprints, _, _ = plan_sprints(tasks, options(capacity=10))
    # C fits in sprint 1 (8/10) but sprint 2 still holds a HIGH task.
    assert [titles(sprint) for sprint in sprints] == [["A"], ["B", "C"]]


def test_dates_names_and_objective():
    sprints, _, _ = plan_sprints(
        [task("A", points=8, epic="Comptes"), task("B", points=8, epic="Catalogue")], options(capacity=10, length=7),
        language="fr",
    )
    assert [(sprint.name, sprint.startDate, sprint.endDate) for sprint in sprints] == [
        ("Sprint 1", date(2026, 10, 5), date(2026, 10, 11)),
        ("Sprint 2", date(2026, 10, 12), date(2026, 10, 18)),
    ]
    assert sprints[0].objective == "Livrer : Comptes"
    english, _, _ = plan_sprints([task("A", epic="Accounts")], options())
    assert english[0].objective == "Deliver: Accounts"


def test_oversized_task_gets_its_own_sprint_and_a_warning():
    sprints, _, warnings = plan_sprints([task("Big", points=13), task("Small", points=2)], options(capacity=5))
    assert [titles(sprint) for sprint in sprints] == [["Big"], ["Small"]]
    assert "consider splitting it" in warnings[0]


def test_at_most_20_sprints_then_backlog_and_excluded_tasks():
    tasks = [task(f"T{index}", points=8) for index in range(22)]
    sprints, backlog, warnings = plan_sprints(tasks, options(capacity=10), excluded=[task("Later")])
    assert len(sprints) == 20
    assert [planned.title for planned in backlog] == ["T20", "T21", "Later"]
    assert "2 task(s) did not fit in 20 sprints" in warnings[0]


def test_deadline_warning():
    _, _, warnings = plan_sprints([task("A", points=8), task("B", points=8)], options(capacity=10),
                                  deadline=date(2026, 10, 20))
    assert warnings == [
        "The last sprint ends on 2026-11-01, after the project deadline (2026-10-20): increase the capacity, "
        "or move tasks to the backlog."
    ]


def test_no_task_no_sprint():
    assert plan_sprints([], options()) == ([], [], [])
