import pytest

from app.schemas.recommendation import RecommendRequest
from app.services.developer_scoring import recommend, skill_key

URL = "/api/v1/ai/developers/recommend"


def candidate(id_, skills=(), open_points=0, open_tasks=0, completed=0, completed_skills=None, name=None):
    return {
        "id": id_,
        "name": name or f"Dev {id_}",
        "skills": [{"name": n, "level": level, **({"yearsOfExperience": y} if y else {})} for n, level, y in skills],
        "openTasks": open_tasks,
        "openPoints": open_points,
        "completedTasks": completed,
        "completedSkills": completed_skills or {},
    }


def body(candidates, required=("Angular", "Node.js"), complexity=3, title="Build the login page", **options):
    return {
        "task": {
            "title": title,
            "description": "",
            "type": "FEATURE",
            "complexity": complexity,
            "requiredSkills": list(required),
        },
        "candidates": candidates,
        "options": options,
    }


def run(candidates, **kwargs):
    return recommend(RecommendRequest.model_validate(body(candidates, **kwargs)))


def test_skill_keys_ignore_case_accents_punctuation_and_aliases():
    assert skill_key("Node.js") == skill_key("nodejs") == skill_key("NODE") == "nodejs"
    assert skill_key("JS") == "javascript"
    assert skill_key("C++") == "c++" != skill_key("C#")
    assert skill_key("Sécurité") == "securite"


def test_formula_of_a_full_match():
    result = run([candidate("a", [("angular", "EXPERT", 0), ("NodeJS", "ADVANCED", 2)], open_points=5,
                            completed=4, completed_skills={"Angular": 2, "Node.js": 1})])
    best = result.recommendations[0]
    # skills (1.0 + min(1, 0.85 + 0.10)) / 2 = 0.975 ; workload 1 - 5/20 = 0.75 ; experience 3/5 = 0.6
    assert best.breakdown.model_dump() == {"skills": 0.975, "workload": 0.75, "experience": 0.6}
    assert best.score == round(100 * (0.6 * 0.975 + 0.25 * 0.75 + 0.15 * 0.6))  # 86
    assert best.matchingSkills == ["angular", "NodeJS"] and best.missingSkills == []
    assert best.similarCompletedTasks == 3
    assert result.skillsSource == "required" and result.warnings == []
    assert best.explanation.startswith("Has 2 of 2 skills: angular (expert), NodeJS (advanced); 5 open points")


def test_ranking_balances_skills_workload_and_experience():
    result = run([
        candidate("busy-expert", [("Angular", "EXPERT", 0), ("Node.js", "EXPERT", 0)], open_points=20),
        candidate("free-beginner", [("Angular", "BEGINNER", 0)]),
        candidate("free-advanced", [("Angular", "ADVANCED", 0), ("Node.js", "ADVANCED", 0)], open_points=3),
        candidate("nothing", []),
    ])
    assert [item.id for item in result.recommendations] == ["free-advanced", "busy-expert", "free-beginner", "nothing"]
    assert result.recommendations[2].missingSkills == ["Node.js"]


def test_beginner_level_counts_half_on_a_complex_task():
    simple = run([candidate("a", [("Angular", "BEGINNER", 0), ("Node.js", "BEGINNER", 0)])], complexity=3)
    complex_ = run([candidate("a", [("Angular", "BEGINNER", 0), ("Node.js", "BEGINNER", 0)])], complexity=8)
    assert simple.recommendations[0].breakdown.skills == 0.4
    assert complex_.recommendations[0].breakdown.skills == 0.2


def test_workload_is_zero_beyond_the_capacity_and_ties_prefer_the_least_loaded():
    result = run([candidate("b", open_points=30, name="Bob"), candidate("a", open_points=30, name="Ann")],
                 required=(), workloadCapacity=10)
    assert [item.breakdown.workload for item in result.recommendations] == [0.0, 0.0]
    assert [item.id for item in result.recommendations] == ["a", "b"]  # same score, then by name


def test_skills_are_inferred_from_the_text_when_the_task_has_none():
    result = run(
        [candidate("a", [("Docker", "ADVANCED", 0), ("Python", "EXPERT", 0)]), candidate("b", [("Java", "EXPERT", 0)])],
        required=(),
        title="Write the Docker compose file of the API",
    )
    assert result.skillsSource == "inferred" and result.skills == ["Docker"]
    assert result.recommendations[0].id == "a"
    assert "skills found in its text were used (Docker)" in result.warnings[0]


def test_without_any_skill_the_score_is_neutral_and_a_warning_explains_it():
    result = run([candidate("a", completed=10), candidate("b")], required=(), title="Prepare the demo")
    assert result.skillsSource == "none"
    assert [item.breakdown.skills for item in result.recommendations] == [0.5, 0.5]
    assert result.recommendations[0].id == "a"  # experience: 10 completed tasks
    assert "relies on workload and experience only" in result.warnings[0]


def test_warning_when_nobody_covers_a_skill_and_limit_option():
    result = run([candidate(str(i), [("Angular", "EXPERT", 0)]) for i in range(8)], limit=3)
    assert len(result.recommendations) == 3
    assert result.warnings == ["No member has all the skills of the task; nobody has: Node.js."]


def test_route(client, auth_headers):
    response = client.post(URL, json=body([candidate("a", [("Angular", "EXPERT", 0)])]), headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["method"] == "scoring" and payload["model"].startswith("transparent scoring")
    assert set(payload["recommendations"][0]) == {
        "id", "score", "matchingSkills", "missingSkills", "similarCompletedTasks", "breakdown", "explanation"
    }


@pytest.mark.parametrize(
    "change, field",
    [
        (lambda b: b.update(candidates=[]), "candidates"),
        (lambda b: b["task"].update(complexity=4), "task.complexity"),
        (lambda b: b["candidates"][0]["skills"].append({"name": "Go", "level": "GURU"}), "candidates.0.skills.1.level"),
        (lambda b: b["options"].update(workloadCapacity=1), "options.workloadCapacity"),
    ],
)
def test_route_validation(client, auth_headers, change, field):
    payload = body([candidate("a", [("Angular", "EXPERT", 0)])])
    change(payload)
    response = client.post(URL, json=payload, headers=auth_headers)
    assert response.status_code == 400
    assert field in [detail["field"] for detail in response.json()["error"]["details"]]


def test_route_requires_the_token(client):
    assert client.post(URL, json=body([candidate("a")])).status_code == 401
