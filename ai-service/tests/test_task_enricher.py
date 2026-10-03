import pytest

from app.services.requirement_parser import Requirement
from app.services.task_enricher import infer_complexity, infer_priority, infer_skills, to_task


def requirement(title, text=None, **fields):
    return Requirement(title=title, text=text or title, epic="Catalogue", **fields)


@pytest.mark.parametrize(
    ("text", "task_type", "expected"),
    [
        ("correction bloquante du paiement", "FEATURE", "CRITICAL"),
        ("export obligatoire des factures", "FEATURE", "HIGH"),
        ("theme sombre optionnel", "FEATURE", "LOW"),
        ("chiffrer les donnees", "SECURITY", "HIGH"),
        ("rediger le guide", "DOCUMENTATION", "LOW"),
        ("page de connexion", "FEATURE", "HIGH"),  # foundation
        ("le systeme doit afficher la liste des livres", "FEATURE", "MEDIUM"),  # "doit" alone is not HIGH
    ],
)
def test_infer_priority(text, task_type, expected):
    assert infer_priority(text, task_type) == expected


@pytest.mark.parametrize(
    ("text", "task_type", "criteria", "expected"),
    [
        ("emprunter un livre", "FEATURE", 0, 3),
        ("afficher le logo", "FEATURE", 0, 2),  # light
        ("paiement en ligne", "FEATURE", 0, 5),  # one heavy topic
        ("paiement en ligne avec notification par e-mail et export pdf", "FEATURE", 0, 8),  # capped at 2 topics
        ("emprunter un livre", "FEATURE", 5, 5),  # many acceptance criteria
        ("rediger le guide", "DOCUMENTATION", 0, 2),
    ],
)
def test_infer_complexity(text, task_type, criteria, expected):
    assert infer_complexity(text, task_type, criteria) == expected


def test_skills_prefer_the_team_spelling_and_the_project_stack():
    skills = infer_skills(
        "creer la page de connexion avec nodejs", "FEATURE", ["Angular", "Node.js", "MongoDB"], ["NodeJS", "Docker"]
    )
    assert skills == ["NodeJS", "Angular", "Authentication", "UI/UX"]


def test_skills_are_limited_to_five_and_avoid_partial_words():
    skills = infer_skills(
        "api rest, docker, kubernetes, tests, e-mail, paiement stripe, tableau de bord", "FEATURE", [], []
    )
    assert len(skills) == 5
    assert infer_skills("reserver un livre", "FEATURE", [], []) == []  # "server" inside "reserver"


def test_to_task_combines_explicit_and_inferred_values():
    task = to_task(requirement("Rechercher un livre", points=5, criteria=["Pagination"]), "fr", ["MongoDB"], [])
    assert (task.type, task.priority, task.complexity, task.epic) == ("FEATURE", "MEDIUM", 5, "Catalogue")
    assert task.requiredSkills == ["MongoDB", "Search"]
    assert task.description == "Critères d'acceptation :\n- Pagination"


def test_bug_type_requires_an_explicit_correction():
    assert to_task(requirement("Afficher un message d'erreur si le mot de passe est incorrect"), "fr", [], []).type \
        != "BUG"
    assert to_task(requirement("Corriger le crash au démarrage"), "fr", [], []).type == "BUG"
