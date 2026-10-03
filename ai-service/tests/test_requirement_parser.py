import pytest

from app.errors import ApiError
from app.services.requirement_parser import detect_language, parse_requirements
from tests.documents import SPECIFICATION_EN, SPECIFICATION_FR


def by_title(text):
    return {requirement.title: requirement for requirement in parse_requirements(text).requirements}


def test_french_specification():
    result = parse_requirements(SPECIFICATION_FR)
    assert result.language == "fr"
    assert result.warnings == []
    assert [(requirement.epic, requirement.title) for requirement in result.requirements] == [
        ("Gestion des adhérents", "Inscription d'un adhérent"),
        ("Gestion des adhérents", "Modification du profil de l'adhérent"),
        ("Gestion des adhérents", "Désactiver un adhérent"),
        ("Catalogue", "Rechercher un livre par titre ou auteur"),
        ("Catalogue", "Import du catalogue depuis un fichier CSV"),
        ("Prêts", "Emprunter un livre"),
        ("Prêts", "Retourner un livre"),
        ("Prêts", "Envoyer un rappel par e-mail avant l'échéance"),
        ("Exigences non fonctionnelles", "L'application doit être responsive"),
        ("Exigences non fonctionnelles", "Les mots de passe doivent être chiffrés avec bcrypt"),
        ("Contraintes techniques", "Déploiement avec Docker sur un serveur Linux"),
        ("Contraintes techniques", "Rédiger la documentation utilisateur"),
        ("Contraintes techniques", "Tests unitaires du module de prêts"),
        ("Backlog", "Exporter les statistiques en PDF"),
        ("Backlog", "Réserver un livre déjà emprunté"),
    ]


def test_context_and_out_of_scope_sections_are_ignored():
    titles = " ".join(by_title(SPECIFICATION_FR))
    assert "remplacé" not in titles and "mobile" not in titles


def test_explicit_metadata_is_read_and_removed_from_the_title():
    requirements = by_title(SPECIFICATION_FR)
    assert requirements["Inscription d'un adhérent"].priority == "HIGH"
    assert requirements["Désactiver un adhérent"].priority == "LOW"
    assert requirements["Rechercher un livre par titre ou auteur"].points == 5
    assert requirements["Import du catalogue depuis un fichier CSV"].points == 5  # 3 days
    exported = requirements["Exporter les statistiques en PDF"]
    assert (exported.priority, exported.points, exported.excluded) == ("MEDIUM", 8, False)
    postponed = requirements["Réserver un livre déjà emprunté"]
    assert (postponed.priority, postponed.points, postponed.excluded) == ("LOW", 3, True)


def test_several_markers_in_one_bracket():
    requirements = by_title(
        "# Catalog\n"
        "- Browse products by category with pagination (Must, 5 pts)\n"
        "- Export the catalog to CSV [Won't have; 2 jours]\n"
        "- Search products by name (fast, accurate)\n"
    )
    browse = requirements["Browse products by category with pagination"]
    assert (browse.priority, browse.points) == ("HIGH", 5)
    export = requirements["Export the catalog to CSV"]
    assert (export.priority, export.points, export.excluded) == ("LOW", 3, True)
    # A bracket that is not only made of markers stays in the text.
    assert "Search products by name (fast, accurate)" in requirements


def test_user_story_keeps_the_story_and_its_criteria():
    story = by_title(SPECIFICATION_FR)["Rechercher un livre par titre ou auteur"]
    assert story.text.startswith("En tant que lecteur, je veux rechercher")
    assert story.criteria == ["La recherche ignore les accents", "Les résultats sont paginés"]
    description = story.description("fr")
    assert "Critères d'acceptation :\n- La recherche ignore les accents" in description


def test_english_backlog_with_labels_and_acceptance_criteria():
    result = parse_requirements(SPECIFICATION_EN)
    assert result.language == "en"
    assert [(requirement.epic, requirement.title, requirement.priority, requirement.points)
            for requirement in result.requirements] == [
        ("Accounts", "Create an account", "HIGH", None),
        ("Accounts", "Reset my password", None, None),
        ("Recipes", "Publish a recipe with photos", None, 8),
        ("Recipes", "Rate a recipe", "LOW", None),
    ]
    assert result.requirements[-1].criteria == [
        "A rating is between 1 and 5 stars", "A member rates a recipe only once"
    ]
    assert result.requirements[-1].description("en").startswith("As a member")


def test_item_with_sub_items_becomes_their_epic():
    text = "- Authentification\n  - Connexion par e-mail\n  - Déconnexion\n- Tableau de bord"
    result = parse_requirements(text)
    assert [(requirement.epic, requirement.title) for requirement in result.requirements] == [
        ("Authentification", "Connexion par e-mail"),
        ("Authentification", "Déconnexion"),
        ("General", "Tableau de bord"),
    ]


def test_numbered_headings_with_content_and_leaf_headings():
    text = "1. Gestion des projets\n- Créer un projet\n- Archiver un projet\n2. Rapports\n3. Export Excel"
    result = parse_requirements(text)
    assert [(requirement.epic, requirement.title) for requirement in result.requirements] == [
        ("Gestion des projets", "Créer un projet"),
        ("Gestion des projets", "Archiver un projet"),
        ("Gestion des projets", "Rapports"),
        ("Gestion des projets", "Export Excel"),
    ]


def test_tab_separated_table_without_header():
    text = "REQ-1\tLe client peut payer par carte bancaire\tHigh\nREQ-2\tLe client reçoit une facture\tLow"
    result = parse_requirements(text)
    assert [(requirement.title, requirement.priority) for requirement in result.requirements] == [
        ("Payer par carte bancaire", "HIGH"),
        ("Le client reçoit une facture", "LOW"),  # no modal verb: the sentence is kept
    ]


def test_table_with_title_description_and_days_columns():
    text = (
        "| Fonctionnalité | Description | Charge |\n"
        "|---|---|---|\n"
        "| Connexion | L'utilisateur se connecte avec son e-mail | 2 |\n"
    )
    requirement = parse_requirements(text).requirements[0]
    assert (requirement.title, requirement.text, requirement.points) == (
        "Connexion", "L'utilisateur se connecte avec son e-mail", 3
    )


def test_requirement_sentences_of_paragraphs():
    text = (
        "Le projet a commencé en janvier. Le système doit envoyer une notification lorsqu'une tâche est assignée. "
        "The platform shall allow managers to export reports."
    )
    titles = list(by_title(text))
    assert titles == ["Envoyer une notification lorsqu'une tâche est assignée", "Export reports"]


def test_duplicates_are_removed():
    assert len(parse_requirements("- Créer un projet\n- créer un projet.\n- Supprimer un projet").requirements) == 2


def test_prose_without_requirement_words_falls_back_to_sentences():
    result = parse_requirements("Une page d'accueil moderne avec les actualités du club. Un espace membre sécurisé.")
    assert len(result.requirements) == 2
    assert "each sentence of the document became a task" in result.warnings[0]


def test_nothing_usable_is_an_error():
    with pytest.raises(ApiError) as error:
        parse_requirements("1 2 3 4 5\n\n6 7 8 9 10 11 12 13 14")
    assert error.value.status_code == 422


def test_at_most_100_requirements():
    text = "\n".join(f"- Fonction numéro {index} à réaliser" for index in range(120))
    result = parse_requirements(text)
    assert len(result.requirements) == 100
    assert "only the first 100" in result.warnings[0]


def test_detect_language():
    assert detect_language("Le système doit gérer les comptes des utilisateurs") == "fr"
    assert detect_language("The system must manage the user accounts") == "en"
