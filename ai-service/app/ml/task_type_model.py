"""Task type classifier of the local analyzer (AI-01).

Model: multinomial Naive Bayes (pure Python, see text_classifier.py) trained on
`data/task_types.csv` — hand-written requirement sentences in French and English, labelled with
the 7 task types of the application. It is saved as JSON in `models/task_type.json` and
re-trained automatically when the file is missing, outdated, or the dataset changed (< 1 s).

    python -m app.ml.task_type_model     # train, evaluate (cross-validation) and save
"""

import csv
import hashlib
import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from .text_classifier import NaiveBayesClassifier, cross_validate

logger = logging.getLogger("ai-service")

DATA_PATH = Path(__file__).parent / "data" / "task_types.csv"
MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "task_type.json"
MODEL_VERSION = 3  # bump when the features change (lexicon, text_classifier.features)
ALPHA = 1.0
DEFAULT_TYPE = "FEATURE"


def load_dataset(path: Path = DATA_PATH) -> tuple[list[str], list[str]]:
    with path.open(encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    return [row["text"] for row in rows], [row["type"] for row in rows]


def _dataset_hash() -> str:
    return hashlib.sha256(DATA_PATH.read_bytes()).hexdigest()


def train_and_save() -> tuple[NaiveBayesClassifier, dict]:
    texts, labels = load_dataset()
    metrics = cross_validate(texts, labels, alpha=ALPHA)
    model = NaiveBayesClassifier(ALPHA).fit(texts, labels)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(
        json.dumps(
            {
                "version": MODEL_VERSION,
                "dataset_sha256": _dataset_hash(),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "metrics": metrics,
                "model": model.to_dict(),
            }
        ),
        encoding="utf-8",
    )
    logger.info("Task type model trained: accuracy %.3f, macro F1 %.3f (cross-validation)",
                metrics["accuracy"], metrics["macro_f1"])
    return model, metrics


@lru_cache
def get_model() -> NaiveBayesClassifier:
    if MODEL_PATH.exists():
        try:
            saved = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
            if saved.get("version") == MODEL_VERSION and saved.get("dataset_sha256") == _dataset_hash():
                return NaiveBayesClassifier.from_dict(saved["model"])
        except (ValueError, KeyError) as exc:  # corrupted file: re-train
            logger.warning("Could not load the task type model (%s): re-training", exc)
    return train_and_save()[0]


def predict_type(text: str, min_confidence: float = 0.35) -> tuple[str, float]:
    """(type, probability); below `min_confidence` the default type FEATURE is returned."""
    label, confidence = get_model().predict(text)
    return (label if confidence >= min_confidence else DEFAULT_TYPE), round(confidence, 3)


if __name__ == "__main__":
    _, scores = train_and_save()
    print(f"Model saved to {MODEL_PATH}")
    print(json.dumps(scores, indent=2))
