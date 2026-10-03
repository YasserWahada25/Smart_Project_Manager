import pytest

from app.errors import ApiError
from app.services.text_extraction import extract_text
from tests.documents import make_docx, make_pdf


def test_text_and_markdown_files():
    text, truncated = extract_text("spec.md", "# Titre\r\n\r\n\r\n\r\n- Créer un compte\n".encode(), 1000)
    assert text == "# Titre\n\n- Créer un compte" and truncated is False


def test_windows_encoded_text_file():
    text, _ = extract_text("spec.TXT", "Le système doit gérer les rôles".encode("cp1252"), 1000)
    assert text == "Le système doit gérer les rôles"


def test_word_document_keeps_headings_lists_and_tables():
    text, _ = extract_text("spec.docx", make_docx(), 1000)
    assert text.splitlines() == [
        "# Gestion des utilisateurs",
        "- Créer un compte utilisateur",
        "Le système doit envoyer un e-mail de bienvenue.",
        "",
        "Fonctionnalité | Priorité",
        "Exporter la liste des utilisateurs | Haute",
    ]


def test_pdf_document():
    text, _ = extract_text("spec.pdf", make_pdf(["Gestion des projets", "- Creer un projet"]), 1000)
    assert text.splitlines() == ["Gestion des projets", "- Creer un projet"]


def test_long_text_is_truncated():
    text, truncated = extract_text("spec.txt", ("x" * 50).encode(), 30)
    assert len(text) == 30 and truncated is True


@pytest.mark.parametrize(
    ("filename", "content", "status"),
    [
        ("spec.exe", b"MZ binary", 415),
        ("spec", b"no extension at all", 415),
        ("spec.txt", b"", 422),
        ("spec.txt", b"short", 422),
        ("spec.pdf", b"%PDF-1.4 not really a pdf", 422),
        ("spec.docx", b"PK not a zip", 422),
    ],
)
def test_rejected_files(filename, content, status):
    with pytest.raises(ApiError) as error:
        extract_text(filename, content, 1000)
    assert error.value.status_code == status


def test_pdf_without_text_is_rejected():
    with pytest.raises(ApiError) as error:
        extract_text("scan.pdf", make_pdf([]), 1000)
    assert error.value.status_code == 422
    assert "scanned" in error.value.message
