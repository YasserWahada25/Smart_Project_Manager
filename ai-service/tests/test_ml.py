import pytest

from app.ml import task_type_model
from app.ml.text_classifier import NaiveBayesClassifier, cross_validate, features, normalize


def test_normalize_removes_case_and_accents():
    assert normalize("Déploiement ÉLÉVÉ") == "deploiement eleve"


def test_features_drop_stop_words_and_add_lexicon_cues():
    found = features("Corriger le crash de la page de connexion")
    assert "w:corriger" in found and "w:crash" in found
    assert "w:le" not in found and "w:de" not in found
    assert "k:BUG" in found


def test_naive_bayes_learns_and_survives_serialization():
    texts = ["fix the crash", "fix the error", "write the guide", "write the manual"]
    labels = ["BUG", "BUG", "DOCUMENTATION", "DOCUMENTATION"]
    model = NaiveBayesClassifier().fit(texts, labels)
    assert model.predict("fix this crash")[0] == "BUG"
    restored = NaiveBayesClassifier.from_dict(model.to_dict())
    assert restored.predict_proba("write a guide") == pytest.approx(model.predict_proba("write a guide"))


def test_unknown_words_are_ignored():
    model = NaiveBayesClassifier().fit(["fix the crash", "write the guide"], ["BUG", "DOCUMENTATION"])
    probabilities = model.predict_proba("zzz qqq")
    # Only the priors remain (equal here).
    assert probabilities["BUG"] == pytest.approx(probabilities["DOCUMENTATION"])


def test_cross_validation_reports_metrics_per_class():
    texts, labels = task_type_model.load_dataset()
    metrics = cross_validate(texts, labels, folds=5)
    assert metrics["samples"] == len(texts)
    assert set(metrics["per_class_f1"]) == set(labels)
    assert 0 <= metrics["accuracy"] <= 1


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Corriger le crash de l'application au démarrage", "BUG"),
        ("Rédiger le guide d'installation", "DOCUMENTATION"),
        ("Configurer le pipeline CI avec GitHub Actions", "DEVOPS"),
        ("Chiffrer les données personnelles", "SECURITY"),
        ("Écrire les tests unitaires du module de paiement", "TESTING"),
        ("Optimiser le temps de chargement du tableau de bord", "IMPROVEMENT"),
        ("L'utilisateur peut créer un projet", "FEATURE"),
    ],
)
def test_predict_type(text, expected):
    assert task_type_model.predict_type(text)[0] == expected


def test_low_confidence_falls_back_to_feature():
    label, confidence = task_type_model.predict_type("zzz", min_confidence=1.01)
    assert label == "FEATURE" and 0 < confidence <= 1


def test_model_is_trained_when_the_file_is_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(task_type_model, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(task_type_model, "MODEL_PATH", tmp_path / "task_type.json")
    task_type_model.get_model.cache_clear()
    try:
        model = task_type_model.get_model()
        assert (tmp_path / "task_type.json").exists()
        assert set(model.classes) == {
            "FEATURE", "BUG", "IMPROVEMENT", "TESTING", "DOCUMENTATION", "DEVOPS", "SECURITY"
        }
        # A corrupted file is replaced.
        (tmp_path / "task_type.json").write_text("{not json", encoding="utf-8")
        task_type_model.get_model.cache_clear()
        assert task_type_model.get_model().classes == model.classes
    finally:
        task_type_model.get_model.cache_clear()
