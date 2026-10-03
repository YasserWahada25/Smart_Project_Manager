"""Binary logistic regression in pure Python (no compiled dependency), with its evaluation metrics.

Features are standardised (z-scores); the weights are fitted by Newton's method (iteratively reweighted
least squares) with a small L2 penalty, which converges in a few iterations on a handful of features.
The contribution of feature i to a prediction is w_i × z_i (log-odds): it explains the result.
"""

import math
import random


def _sigmoid(value: float) -> float:
    if value >= 0:
        return 1 / (1 + math.exp(-value))
    exp = math.exp(value)
    return exp / (1 + exp)


def _solve(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting (small dense systems)."""
    size = len(vector)
    rows = [matrix[i][:] + [vector[i]] for i in range(size)]
    for col in range(size):
        pivot = max(range(col, size), key=lambda r: abs(rows[r][col]))
        rows[col], rows[pivot] = rows[pivot], rows[col]
        if abs(rows[col][col]) < 1e-12:
            raise ValueError("singular system")
        for r in range(size):
            if r != col:
                factor = rows[r][col] / rows[col][col]
                rows[r] = [a - factor * b for a, b in zip(rows[r], rows[col])]
    return [rows[i][size] / rows[i][i] for i in range(size)]


class LogisticRegression:
    def __init__(self, l2: float = 0.01, max_iterations: int = 25):
        self.l2 = l2
        self.max_iterations = max_iterations
        self.means: list[float] = []
        self.stds: list[float] = []
        self.weights: list[float] = []  # weights[0] = intercept
        self.iterations = 0

    def _standardise(self, row: list[float]) -> list[float]:
        return [(value - mean) / std for value, mean, std in zip(row, self.means, self.stds)]

    def fit(self, rows: list[list[float]], labels: list[int]) -> "LogisticRegression":
        n, size = len(rows), len(rows[0])
        self.means = [sum(row[j] for row in rows) / n for j in range(size)]
        self.stds = [
            math.sqrt(sum((row[j] - self.means[j]) ** 2 for row in rows) / n) or 1.0 for j in range(size)
        ]
        design = [[1.0, *self._standardise(row)] for row in rows]
        weights = [0.0] * (size + 1)
        for iteration in range(1, self.max_iterations + 1):
            gradient = [0.0] * (size + 1)
            hessian = [[0.0] * (size + 1) for _ in range(size + 1)]
            for x, y in zip(design, labels):
                p = _sigmoid(sum(w * v for w, v in zip(weights, x)))
                error, curvature = p - y, p * (1 - p)
                for i in range(size + 1):
                    gradient[i] += error * x[i]
                    for j in range(i, size + 1):
                        hessian[i][j] += curvature * x[i] * x[j]
            for i in range(size + 1):
                for j in range(i):
                    hessian[i][j] = hessian[j][i]
                if i > 0:  # the intercept is not penalised
                    gradient[i] += self.l2 * weights[i]
                    hessian[i][i] += self.l2
            step = _solve(hessian, gradient)
            weights = [w - s for w, s in zip(weights, step)]
            self.iterations = iteration
            if max(abs(s) for s in step) < 1e-8:
                break
        self.weights = weights
        return self

    def contributions(self, row: list[float]) -> list[float]:
        return [w * z for w, z in zip(self.weights[1:], self._standardise(row))]

    def predict_proba(self, row: list[float]) -> float:
        return _sigmoid(self.weights[0] + sum(self.contributions(row)))

    def to_dict(self) -> dict:
        return {"l2": self.l2, "means": self.means, "stds": self.stds, "weights": self.weights}

    @classmethod
    def from_dict(cls, data: dict) -> "LogisticRegression":
        model = cls(l2=data["l2"])
        model.means, model.stds, model.weights = data["means"], data["stds"], data["weights"]
        return model


def stratified_split(labels: list[int], test_ratio: float, seed: int) -> tuple[list[int], list[int]]:
    """Indices of the train and test sets, with the same share of each class in both."""
    rng = random.Random(seed)
    train, test = [], []
    for value in (0, 1):
        indices = [i for i, label in enumerate(labels) if label == value]
        rng.shuffle(indices)
        cut = round(len(indices) * test_ratio)
        test += indices[:cut]
        train += indices[cut:]
    return sorted(train), sorted(test)


def roc_auc(labels: list[int], scores: list[float]) -> float:
    """Probability that a random positive is scored above a random negative (ties count half)."""
    ranked = sorted(zip(scores, labels))
    positives = sum(labels)
    negatives = len(labels) - positives
    if not positives or not negatives:
        return float("nan")
    rank_sum, i = 0.0, 0
    while i < len(ranked):
        j = i
        while j < len(ranked) and ranked[j][0] == ranked[i][0]:
            j += 1
        average_rank = (i + j + 1) / 2  # ranks are 1-based
        rank_sum += average_rank * sum(label for _, label in ranked[i:j])
        i = j
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def classification_metrics(labels: list[int], predictions: list[int]) -> dict:
    tp = sum(1 for y, p in zip(labels, predictions) if y and p)
    tn = sum(1 for y, p in zip(labels, predictions) if not y and not p)
    fp = sum(1 for y, p in zip(labels, predictions) if not y and p)
    fn = sum(1 for y, p in zip(labels, predictions) if y and not p)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "accuracy": round((tp + tn) / len(labels), 3),
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }
