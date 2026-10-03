"""AI-03 — sprint delay risk model (logistic regression on the 7 features of sprint_features.py).

Trained on `data/sprint_risk.csv` (simulated sprints, see sprint_risk_data.py): stratified split
75 % train / 25 % test (seed 42), evaluated on the test set and compared with a simple rule (the sprint
is late when less than (elapsed − 10 points) % of the story points are done). The evaluated model is
saved as JSON in `models/sprint_risk.json` and re-trained automatically when the file is missing,
outdated or the dataset changed (about one second).

    python -m app.ml.sprint_risk_model     # train, evaluate and save
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from .logistic_regression import LogisticRegression, classification_metrics, roc_auc, stratified_split
from .sprint_features import FEATURES, features
from .sprint_risk_data import DATA_PATH, load_dataset

logger = logging.getLogger("ai-service")

MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "sprint_risk.json"
MODEL_VERSION = 1  # bump when the features or the training change
MODEL_NAME = "logistic regression (7 features, synthetic sprints)"
TEST_RATIO, SPLIT_SEED, L2 = 0.25, 42, 0.01
BASELINE_GAP = 0.10


def _dataset_hash() -> str:
    return hashlib.sha256(DATA_PATH.read_bytes()).hexdigest()


def evaluate(model: LogisticRegression, rows: list[list[float]], labels: list[int]) -> dict:
    scores = [model.predict_proba(row) for row in rows]
    metrics = classification_metrics(labels, [int(score >= 0.5) for score in scores])
    metrics["roc_auc"] = round(roc_auc(labels, scores), 3)
    return metrics


def train_and_save() -> tuple[LogisticRegression, dict]:
    samples = load_dataset()
    rows = [features(snapshot) for snapshot, _ in samples]
    labels = [int(delayed) for _, delayed in samples]
    train, test = stratified_split(labels, TEST_RATIO, SPLIT_SEED)
    model = LogisticRegression(l2=L2).fit([rows[i] for i in train], [labels[i] for i in train])

    test_rows, test_labels = [rows[i] for i in test], [labels[i] for i in test]
    gap = FEATURES.index("progress_gap")
    baseline = classification_metrics(test_labels, [int(row[gap] > BASELINE_GAP) for row in test_rows])
    metrics = {
        "samples": len(samples),
        "delayed_share": round(sum(labels) / len(labels), 3),
        "train": len(train),
        "test": len(test),
        "split": f"stratified {int((1 - TEST_RATIO) * 100)} / {int(TEST_RATIO * 100)} (seed {SPLIT_SEED})",
        "model": evaluate(model, test_rows, test_labels),
        "baseline_rule": {"rule": f"progress_gap > {BASELINE_GAP}", **baseline},
        "weights": {name: round(weight, 3) for name, weight in zip(("intercept", *FEATURES), model.weights)},
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(
        json.dumps({
            "version": MODEL_VERSION,
            "dataset_sha256": _dataset_hash(),
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "metrics": metrics,
            "model": model.to_dict(),
        }),
        encoding="utf-8",
    )
    logger.info("Sprint risk model trained: accuracy %.3f, ROC AUC %.3f (test set)",
                metrics["model"]["accuracy"], metrics["model"]["roc_auc"])
    return model, metrics


@lru_cache
def get_model() -> tuple[LogisticRegression, dict]:
    """(model, metrics) — loaded from the JSON file, or re-trained."""
    if MODEL_PATH.exists():
        try:
            saved = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
            if saved.get("version") == MODEL_VERSION and saved.get("dataset_sha256") == _dataset_hash():
                return LogisticRegression.from_dict(saved["model"]), saved["metrics"]
        except (ValueError, KeyError) as exc:  # corrupted file: re-train
            logger.warning("Could not load the sprint risk model (%s): re-training", exc)
    return train_and_save()


if __name__ == "__main__":
    _, scores = train_and_save()
    print(f"Model saved to {MODEL_PATH}")
    print(json.dumps(scores, indent=2))
