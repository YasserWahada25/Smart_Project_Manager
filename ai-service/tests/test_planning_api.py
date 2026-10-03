import json

import httpx
import pytest

from app.config import get_settings
from app.services.llm_client import OpenAiClient, get_llm_client
from tests.documents import SPECIFICATION_FR, make_docx

PLAN_URL = "/api/v1/ai/projects/plan"
EXTRACT_URL = "/api/v1/ai/documents/extract"


def plan_body(text=SPECIFICATION_FR, **options):
    return {
        "text": text,
        "project": {"name": "Bibliothèque", "technologies": ["Angular", "Node.js", "MongoDB"], "deadline": None},
        "options": {"startDate": "2026-10-05", "sprintLengthDays": 14, "capacityPerSprint": 15, **options},
        "teamSkills": ["Docker"],
    }


def llm_answer(epics):
    content = json.dumps({"epics": epics})
    return {"choices": [{"message": {"role": "assistant", "content": content}, "finish_reason": "stop"}]}


def use_llm(client, handler):
    llm = OpenAiClient("sk-test", "gpt-test", "https://llm.test/v1", 5, transport=httpx.MockTransport(handler))
    client.app.dependency_overrides[get_llm_client] = lambda: llm


LLM_TASK = {
    "title": "Créer la page d'inscription",
    "description": "Formulaire avec validation",
    "type": "FEATURE",
    "priority": "HIGH",
    "complexity": 5,
    "requiredSkills": ["Angular", " ", "angular ", "Node.js"],
    "excluded": False,
}


@pytest.mark.parametrize("url", [PLAN_URL, EXTRACT_URL])
def test_routes_require_the_service_token(client, url):
    response = client.post(url, json=plan_body(), headers={"X-AI-Service-Token": "wrong"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_plan_with_the_local_analyzer(client, auth_headers):
    response = client.post(PLAN_URL, json=plan_body(), headers=auth_headers)
    assert response.status_code == 200
    plan = response.json()
    assert plan["method"] == "local"
    assert plan["model"].startswith("local analyzer")
    assert plan["stats"]["taskCount"] == 15
    assert plan["stats"]["sprintCount"] == len(plan["sprints"]) >= 4
    assert plan["sprints"][0]["name"] == "Sprint 1"
    assert plan["sprints"][0]["startDate"] == "2026-10-05"
    assert plan["sprints"][0]["endDate"] == "2026-10-18"
    assert all(sprint["totalPoints"] <= 15 for sprint in plan["sprints"])
    assert [task["title"] for task in plan["backlog"]] == ["Réserver un livre déjà emprunté"]  # Won't have
    first = plan["sprints"][0]["tasks"][0]
    assert set(first) == {"title", "description", "type", "priority", "complexity", "requiredSkills", "epic"}


def test_plan_with_the_llm(client, auth_headers):
    seen = {}

    def handler(request):
        seen["prompt"] = json.loads(request.content)["messages"][1]["content"]
        epics = [
            {"name": "Comptes", "tasks": [LLM_TASK, {**LLM_TASK, "title": "Créer la page d'inscription "}]},
            {"name": "Plus tard", "tasks": [{**LLM_TASK, "title": "Application mobile", "excluded": True}]},
        ]
        return httpx.Response(200, json=llm_answer(epics))

    use_llm(client, handler)
    response = client.post(PLAN_URL, json=plan_body(), headers=auth_headers)
    plan = response.json()
    assert (plan["method"], plan["model"], plan["warnings"]) == ("llm", "gpt-test", [])
    assert [task["title"] for task in plan["sprints"][0]["tasks"]] == ["Créer la page d'inscription"]  # deduplicated
    assert plan["sprints"][0]["tasks"][0]["requiredSkills"] == ["Angular", "Node.js"]
    assert plan["sprints"][0]["tasks"][0]["epic"] == "Comptes"
    assert [task["title"] for task in plan["backlog"]] == ["Application mobile"]
    assert "Project technologies: Angular, Node.js, MongoDB" in seen["prompt"]
    assert "<<<DOCUMENT\n# Cahier des charges" in seen["prompt"]


@pytest.mark.parametrize(
    "answer",
    [
        httpx.Response(200, json=llm_answer([{"name": "X", "tasks": [{**LLM_TASK, "complexity": 4}]}])),
        httpx.Response(200, json=llm_answer([{"name": "X", "tasks": [{**LLM_TASK, "type": "EPIC"}]}])),
        httpx.Response(200, json=llm_answer([])),
        httpx.Response(503, json={"error": {"message": "overloaded"}}),
    ],
)
def test_invalid_or_failed_llm_answer_falls_back_to_the_local_analyzer(client, auth_headers, answer):
    use_llm(client, lambda request: answer)
    plan = client.post(PLAN_URL, json=plan_body(), headers=auth_headers).json()
    assert plan["method"] == "local"
    assert plan["warnings"][0].startswith("OpenAI could not analyse the document (")
    assert plan["stats"]["taskCount"] == 15


def test_long_document_is_truncated_for_the_llm(client, auth_headers):
    sizes = []

    def handler(request):
        sizes.append(len(json.loads(request.content)["messages"][1]["content"]))
        return httpx.Response(200, json=llm_answer([{"name": "X", "tasks": [LLM_TASK]}]))

    use_llm(client, handler)
    text = "- Le système doit gérer les comptes.\n" * 1000  # 37 000 characters
    plan = client.post(PLAN_URL, json=plan_body(text), headers=auth_headers).json()
    assert plan["warnings"] == ["The document is long: only its first 30000 characters were sent to OpenAI."]
    assert sizes[0] < 31_000


@pytest.mark.parametrize(
    ("body", "field"),
    [
        (plan_body("trop court"), "text"),
        (plan_body(sprintLengthDays=2), "options.sprintLengthDays"),
        (plan_body(capacityPerSprint=500), "options.capacityPerSprint"),
        ({**plan_body(), "project": {"name": ""}}, "project.name"),
    ],
)
def test_plan_request_validation(client, auth_headers, body, field):
    response = client.post(PLAN_URL, json=body, headers=auth_headers)
    assert response.status_code == 400
    assert field in [detail["field"] for detail in response.json()["error"]["details"]]


def test_plan_without_requirements(client, auth_headers):
    response = client.post(PLAN_URL, json=plan_body("1 2 3 4 5 6 7 8 9 10 11 12 13 14 15"), headers=auth_headers)
    assert response.status_code == 422
    assert "No requirement could be identified" in response.json()["error"]["message"]


def test_extract_a_word_document(client, auth_headers):
    files = {"file": ("cahier.docx", make_docx(), "application/octet-stream")}
    response = client.post(EXTRACT_URL, files=files, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "cahier.docx"
    assert body["text"].startswith("# Gestion des utilisateurs\n- Créer un compte utilisateur")
    assert body["characters"] == len(body["text"]) and body["truncated"] is False


def test_extract_rejects_unsupported_and_too_large_files(client, auth_headers):
    response = client.post(EXTRACT_URL, files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
                           headers=auth_headers)
    assert response.status_code == 415

    settings = get_settings().model_copy(update={"max_upload_bytes": 1024})
    client.app.dependency_overrides[get_settings] = lambda: settings
    response = client.post(EXTRACT_URL, files={"file": ("big.txt", b"x" * 2048, "text/plain")}, headers=auth_headers)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_extract_requires_a_file(client, auth_headers):
    response = client.post(EXTRACT_URL, headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["error"]["details"][0]["field"] == "file"
