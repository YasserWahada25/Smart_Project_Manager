"""Multinomial Naive Bayes text classifier in pure Python (no compiled dependency).

Features of a text (see `features`): lower-cased, accent-free words without stop words, plus
one "cue" feature per task type whose lexicon matches (see lexicon.py). Probabilities use
Laplace (additive) smoothing and are computed in log space. Like a fixed vocabulary vectorizer,
prediction ignores the features never seen in training: otherwise unknown words would favour the
class with the fewest training words.
"""

import math
import random
import re
import unicodedata
from collections import Counter, defaultdict

from .lexicon import PATTERNS, STOP_WORDS

_WORD = re.compile(r"[a-z0-9]+")
# Weight of a lexicon cue compared with a word (tuned by cross-validation, see docs/ai.md).
CUE_WEIGHT = 2.0


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def features(text: str) -> Counter:
    normalized = normalize(text)
    words = Counter(
        word for word in _WORD.findall(normalized) if len(word) > 1 and word not in STOP_WORDS
    )
    # Sub-linear term frequency: a repeated word does not dominate the decision.
    found = Counter({f"w:{word}": 1 + math.log(count) for word, count in words.items()})
    for label, pattern in PATTERNS.items():
        hits = len(pattern.findall(normalized))
        if hits:
            found[f"k:{label}"] = CUE_WEIGHT * (1 + math.log(hits))
    return found


class NaiveBayesClassifier:
    def __init__(self, alpha: float = 1.0):
        self.alpha = alpha
        self.classes: list[str] = []
        self.log_priors: dict[str, float] = {}
        self.feature_log_probs: dict[str, dict[str, float]] = {}
        self.unknown_log_probs: dict[str, float] = {}
        self.vocabulary: set[str] = set()

    def fit(self, texts: list[str], labels: list[str]) -> "NaiveBayesClassifier":
        self.classes = sorted(set(labels))
        counts: dict[str, Counter] = defaultdict(Counter)
        for text, label in zip(texts, labels):
            counts[label].update(features(text))
        self.vocabulary = {name for counter in counts.values() for name in counter}
        label_counts = Counter(labels)
        for label in self.classes:
            self.log_priors[label] = math.log(label_counts[label] / len(labels))
            total = sum(counts[label].values()) + self.alpha * len(self.vocabulary)
            self.feature_log_probs[label] = {
                name: math.log((value + self.alpha) / total) for name, value in counts[label].items()
            }
            self.unknown_log_probs[label] = math.log(self.alpha / total)
        return self

    def predict_proba(self, text: str) -> dict[str, float]:
        found = {name: weight for name, weight in features(text).items() if name in self.vocabulary}
        scores = {}
        for label in self.classes:
            log_probs = self.feature_log_probs[label]
            unknown = self.unknown_log_probs[label]
            scores[label] = self.log_priors[label] + sum(
                weight * log_probs.get(name, unknown) for name, weight in found.items()
            )
        best = max(scores.values())
        exponentials = {label: math.exp(score - best) for label, score in scores.items()}
        total = sum(exponentials.values())
        return {label: value / total for label, value in exponentials.items()}

    def predict(self, text: str) -> tuple[str, float]:
        probabilities = self.predict_proba(text)
        label = max(probabilities, key=probabilities.get)
        return label, probabilities[label]

    def to_dict(self) -> dict:
        return {
            "alpha": self.alpha,
            "classes": self.classes,
            "log_priors": self.log_priors,
            "feature_log_probs": self.feature_log_probs,
            "unknown_log_probs": self.unknown_log_probs,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NaiveBayesClassifier":
        model = cls(alpha=data["alpha"])
        model.classes = data["classes"]
        model.log_priors = data["log_priors"]
        model.feature_log_probs = data["feature_log_probs"]
        model.unknown_log_probs = data["unknown_log_probs"]
        model.vocabulary = {name for log_probs in model.feature_log_probs.values() for name in log_probs}
        return model


def stratified_folds(labels: list[str], folds: int, seed: int) -> list[list[int]]:
    """Indices split in `folds` groups keeping the class proportions."""
    by_label: dict[str, list[int]] = defaultdict(list)
    for index, label in enumerate(labels):
        by_label[label].append(index)
    rng = random.Random(seed)
    groups: list[list[int]] = [[] for _ in range(folds)]
    for label in sorted(by_label):
        indices = by_label[label]
        rng.shuffle(indices)
        for position, index in enumerate(indices):
            groups[position % folds].append(index)
    return groups


def cross_validate(texts: list[str], labels: list[str], folds: int = 5, seed: int = 42, alpha: float = 1.0) -> dict:
    """Each text is predicted by a model trained without it; returns accuracy and per-class F1."""
    predicted: list[str] = [""] * len(texts)
    for test in stratified_folds(labels, folds, seed):
        test_set = set(test)
        train = [index for index in range(len(texts)) if index not in test_set]
        model = NaiveBayesClassifier(alpha).fit([texts[i] for i in train], [labels[i] for i in train])
        for index in test:
            predicted[index] = model.predict(texts[index])[0]

    per_class = {}
    for label in sorted(set(labels)):
        true_positive = sum(1 for p, t in zip(predicted, labels) if p == label and t == label)
        predicted_count = predicted.count(label)
        actual_count = labels.count(label)
        precision = true_positive / predicted_count if predicted_count else 0.0
        recall = true_positive / actual_count if actual_count else 0.0
        per_class[label] = round(2 * precision * recall / (precision + recall), 3) if precision + recall else 0.0
    accuracy = sum(1 for p, t in zip(predicted, labels) if p == t) / len(labels)
    return {
        "samples": len(texts),
        "cv": f"stratified {folds}-fold (seed {seed})",
        "accuracy": round(accuracy, 3),
        "macro_f1": round(sum(per_class.values()) / len(per_class), 3),
        "per_class_f1": per_class,
    }
