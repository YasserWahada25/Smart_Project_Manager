import json

import httpx
import pytest

from app.services.llm_client import LlmError, OpenAiClient

SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False, "required": []}


def completion(content, finish_reason="stop", refusal=None):
    message = {"role": "assistant", "content": content, "refusal": refusal}
    return {"choices": [{"index": 0, "message": message, "finish_reason": finish_reason}]}


def client_for(handler, timeout=5):
    transport = httpx.MockTransport(handler)
    return OpenAiClient("sk-test-key", "gpt-test", "https://llm.test/v1/", timeout, transport=transport)


def call(client):
    return client.complete_json("system text", "user text", "project_plan", SCHEMA)


def test_sends_a_strict_structured_output_request():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["Authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=completion('{"epics": []}'))

    assert call(client_for(handler)) == {"epics": []}
    assert seen["url"] == "https://llm.test/v1/chat/completions"
    assert seen["auth"] == "Bearer sk-test-key"
    body = seen["body"]
    assert body["model"] == "gpt-test"
    assert body["messages"] == [
        {"role": "system", "content": "system text"},
        {"role": "user", "content": "user text"},
    ]
    assert body["response_format"] == {
        "type": "json_schema",
        "json_schema": {"name": "project_plan", "strict": True, "schema": SCHEMA},
    }
    assert body["temperature"] == 0.2


def test_retries_without_temperature_when_the_model_refuses_it():
    bodies = []

    def handler(request):
        bodies.append(json.loads(request.content))
        if "temperature" in bodies[-1]:
            return httpx.Response(400, json={"error": {"message": "Unsupported value: 'temperature'"}})
        return httpx.Response(200, json=completion("{}"))

    assert call(client_for(handler)) == {}
    assert len(bodies) == 2 and "temperature" not in bodies[1]


@pytest.mark.parametrize(
    ("response", "reason"),
    [
        (httpx.Response(401, json={"error": {"message": "Incorrect API key provided: sk-tes***"}}), "API key"),
        (
            httpx.Response(429, json={"error": {"message": "slow down", "code": "rate_limit_exceeded"}}),
            "rate limit or free quota reached",
        ),
        (
            httpx.Response(429, json={"error": {"type": "insufficient_quota", "code": "credit_balance_exhausted"}}),
            "no credits left",
        ),
        (httpx.Response(429, text="not json"), "rate limit or free quota reached"),
        (httpx.Response(500, text="oops"), "OpenAI error 500"),
        (httpx.Response(200, text="not json"), "unexpected answer format"),
        (httpx.Response(200, json={"choices": []}), "unexpected answer format"),
        (httpx.Response(200, json=completion(None, refusal="I can't")), "refused"),
        (httpx.Response(200, json=completion('{"epics": [', finish_reason="length")), "cut"),
        (httpx.Response(200, json=completion("{not json")), "not valid JSON"),
        (httpx.Response(200, json=completion("[1, 2]")), "not a JSON object"),
    ],
)
def test_errors_become_llm_errors(response, reason):
    with pytest.raises(LlmError, match=reason):
        call(client_for(lambda request: response))


def test_timeout_and_network_errors():
    def slow(request):
        raise httpx.ReadTimeout("slow", request=request)

    def down(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(LlmError, match="no answer within 5 s"):
        call(client_for(slow))
    with pytest.raises(LlmError, match="unreachable"):
        call(client_for(down))


def test_the_api_key_is_never_logged(caplog):
    response = httpx.Response(401, json={"error": {"message": "Incorrect API key provided: sk-test-key"}})
    with pytest.raises(LlmError):
        call(client_for(lambda request: response))
    assert "sk-test-key" not in caplog.text


def test_compatible_providers_get_the_same_request_without_openai_only_fields():
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json=completion('```json\n{"epics": []}\n```'))

    gemini = OpenAiClient("AIza-test", "gemini-flash", "https://generativelanguage.googleapis.com/v1beta/openai/", 5,
                          transport=httpx.MockTransport(handler), provider="gemini", provider_label="Google Gemini")
    assert gemini.complete_json("s", "u", "project_plan", SCHEMA) == {"epics": []}  # code fence removed
    gemini.chat([{"role": "user", "content": "hi"}],
                [{"type": "function", "function": {"name": "f", "strict": True, "parameters": SCHEMA}}])
    plan, chat = seen
    assert plan["max_tokens"] == 12_000 and "max_completion_tokens" not in plan
    assert plan["response_format"]["json_schema"] == {"name": "project_plan", "schema": SCHEMA}
    assert "strict" not in chat["tools"][0]["function"] and chat["max_tokens"] == 2_000


@pytest.mark.parametrize(
    ("response", "reason"),
    [
        (httpx.Response(400, json=[{"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.",
                                              "status": "INVALID_ARGUMENT"}}]), "Google Gemini API key was rejected"),
        (httpx.Response(429, json=[{"error": {"code": 429, "status": "RESOURCE_EXHAUSTED"}}]),
         "Google Gemini rate limit or free quota reached"),
        (httpx.Response(503, json={"error": {"message": "overloaded"}}), "Google Gemini error 503"),
    ],
)
def test_errors_name_the_provider(response, reason):
    gemini = OpenAiClient("AIza-test", "gemini-flash", "https://g.test/v1beta/openai", 5,
                          transport=httpx.MockTransport(lambda request: response),
                          provider="gemini", provider_label="Google Gemini")
    with pytest.raises(LlmError, match=reason):
        gemini.chat([{"role": "user", "content": "hi"}], [])


def test_temporary_errors_are_retried_once():
    answers = [
        httpx.Response(503, json={"error": {"message": "overloaded"}}),
        httpx.Response(200, json=completion("{}")),
    ]
    assert call(client_for(lambda request: answers.pop(0))) == {}
    still_down = [httpx.Response(503, json={}), httpx.Response(503, json={})]
    with pytest.raises(LlmError, match="error 503"):
        call(client_for(lambda request: still_down.pop(0)))
    assert still_down == []  # exactly two attempts
