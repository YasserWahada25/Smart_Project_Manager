import math

import pytest

from app.ml import sprint_risk_model
from app.ml.logistic_regression import LogisticRegression, classification_metrics, roc_auc, stratified_split
from app.ml.sprint_features import FEATURES, SprintSnapshot, features
from app.ml.sprint_risk_data import generate, load_dataset
from app.schemas.risk import RiskRequest
from app.services.sprint_risk import predict_risk, risk_level

URL = "/api/v1/ai/sprints/predict-risk"


def request_body(as_of="2026-10-08", total=10, done=5, blocked=0, complex_=0, unassigned=0, points=30,
                 done_points=15, size=3, velocity=2.0, start="2026-10-01", end="2026-10-14"):
    return {
        "sprint": {"startDate": start, "endDate": end, "asOf": as_of},
        "tasks": {"total": total, "done": done, "blocked": blocked, "highComplexityOpen": complex_,
                  "unassignedOpen": unassigned, "totalPoints": points, "donePoints": done_points},
        "team": {"size": size, "historicalVelocity": velocity},
    }


def predict(**kwargs):
    return predict_risk(RiskRequest.model_validate(request_body(**kwargs)))


def snapshot(**overrides):
    values = dict(duration_days=10, elapsed_days=5, total_tasks=10, done_tasks=4, blocked_tasks=2,
                  high_complexity_open=1, unassigned_open=3, total_points=40, done_points=10, team_size=2,
                  historical_velocity=None)
    return SprintSnapshot(**{**values, **overrides})


def test_features_of_a_snapshot():
    row = dict(zip(FEATURES, features(snapshot())))
    assert row["elapsed_ratio"] == 0.5
    assert row["progress_gap"] == 0.25  # 50 % of the time, 25 % of the points
    assert row["pace_ratio"] == 3.0  # 30 points / 5 days = 6 ÷ usual pace 10 / 5 = 2
    assert row["blocked_ratio"] == pytest.approx(2 / 6)
    assert row["unassigned_ratio"] == 0.5
    assert row["load_per_member"] == 3.0  # 30 / 2 members / 5 days
    # Historical velocity first; the ratios are capped at 5.
    assert dict(zip(FEATURES, features(snapshot(historical_velocity=1.0))))["pace_ratio"] == 5.0


def test_logistic_regression_learns_a_separable_rule_and_survives_serialisation():
    rows = [[x / 10, (x % 7) / 7] for x in range(200)]
    labels = [int(row[0] > 10) for row in rows]
    model = LogisticRegression().fit(rows, labels)
    assert model.predict_proba([15.0, 0.5]) > 0.95 > 0.05 > model.predict_proba([5.0, 0.5])
    copy = LogisticRegression.from_dict(model.to_dict())
    assert copy.predict_proba([12.0, 0.1]) == model.predict_proba([12.0, 0.1])
    assert len(model.contributions([12.0, 0.1])) == 2


def test_metrics_helpers():
    assert roc_auc([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]) == 0.75
    assert roc_auc([0, 1], [0.5, 0.5]) == 0.5
    assert math.isnan(roc_auc([1, 1], [0.2, 0.3]))
    metrics = classification_metrics([1, 1, 0, 0], [1, 0, 1, 0])
    assert (metrics["accuracy"], metrics["precision"], metrics["recall"], metrics["f1"]) == (0.5, 0.5, 0.5, 0.5)
    train, test = stratified_split([0] * 8 + [1] * 4, 0.25, seed=1)
    assert len(test) == 3 and len(train) == 9 and not set(train) & set(test)


def test_dataset_is_reproducible_and_balanced():
    samples = load_dataset()
    assert len(samples) == 2000
    assert 0.4 < sum(label for _, label in samples) / len(samples) < 0.6
    regenerated = generate(rows=5)
    assert [s for s, _ in regenerated] == [s for s, _ in samples[:5]]  # same seed, same sprints


def test_trained_model_beats_the_baseline_rule(tmp_path, monkeypatch):
    monkeypatch.setattr(sprint_risk_model, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(sprint_risk_model, "MODEL_PATH", tmp_path / "sprint_risk.json")
    sprint_risk_model.get_model.cache_clear()
    try:
        _, metrics = sprint_risk_model.get_model()
        assert (tmp_path / "sprint_risk.json").exists()
        assert metrics["test"] == 500
        assert metrics["model"]["accuracy"] >= 0.8 and metrics["model"]["roc_auc"] >= 0.9
        assert metrics["model"]["f1"] > metrics["baseline_rule"]["f1"]
        assert metrics["weights"]["pace_ratio"] > 0 and metrics["weights"]["blocked_ratio"] > 0
    finally:
        sprint_risk_model.get_model.cache_clear()


def test_risk_levels():
    levels = [risk_level(p) for p in (0.1, 0.34, 0.35, 0.64, 0.65, 0.99)]
    assert levels == ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"]


def test_a_sprint_on_track_is_low_risk():
    result = predict(as_of="2026-10-08", done_points=18, velocity=3.0)
    assert result.method == "model" and result.riskLevel == "LOW" and result.probability < 0.35


def test_a_late_sprint_is_high_risk_with_its_factors():
    result = predict(as_of="2026-10-11", done=2, done_points=4, blocked=3, unassigned=3, velocity=2.0)
    assert result.riskLevel == "HIGH" and result.probability > 0.9
    codes = [factor.code for factor in result.factors]
    assert codes == ["progress_gap", "pace_ratio", "load_per_member"]
    assert result.factors[0].label == "Behind schedule: 71% of the time elapsed, 13% of the story points done"
    assert result.factors[1].label.startswith("Needs 3.2× the usual pace: 6.5 points/day for 4 remaining days")
    assert all(factor.impact >= 0.25 for factor in result.factors)
    assert result.features["progress_gap"] == pytest.approx(10 / 14 - 4 / 30, abs=1e-3)
    assert result.model["name"].startswith("logistic regression") and 0 < result.model["rocAuc"] <= 1


@pytest.mark.parametrize(
    "kwargs, level, probability, code",
    [
        ({"total": 0, "done": 0, "points": 0, "done_points": 0}, "LOW", 0.0, "empty"),
        ({"done": 10, "done_points": 30}, "LOW", 0.0, "done"),
        ({"as_of": "2026-10-20"}, "HIGH", 1.0, "overdue"),
    ],
)
def test_obvious_cases_are_decided_by_rule(kwargs, level, probability, code):
    result = predict(**kwargs)
    assert (result.method, result.riskLevel, result.probability) == ("rule", level, probability)
    assert result.factors[0].code == code


def test_a_medium_risk_always_names_its_main_cause():
    result = predict()
    assert result.riskLevel == "MEDIUM" and len(result.factors) == 1 and result.factors[0].impact > 0


def test_warnings_for_a_missing_team_or_history():
    result = predict(size=0, velocity=None)
    assert any("no active developer" in warning for warning in result.warnings)
    assert any("No completed sprint yet" in warning for warning in result.warnings)


def test_route(client, auth_headers):
    response = client.post(URL, json=request_body(), headers=auth_headers)
    assert response.status_code == 200
    assert set(response.json()) == {"riskLevel", "probability", "method", "factors", "features", "model", "warnings"}
    assert client.post(URL, json=request_body()).status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        lambda b: b["tasks"].update(done=11),
        lambda b: b["tasks"].update(blocked=6),
        lambda b: b["sprint"].update(endDate="2026-09-01"),
        lambda b: b["team"].update(size=-1),
    ],
)
def test_route_validation(client, auth_headers, change):
    body = request_body()
    change(body)
    assert client.post(URL, json=body, headers=auth_headers).status_code == 400
