"""OpenAI-compatible Chat Completions client (OpenAI, Google Gemini, Groq, Ollama…), used by AI-01 and AI-04.

- OpenAI: structured outputs and tools in strict mode, `max_completion_tokens`.
- Other providers ("compatible" mode): the same requests without the `strict` flags and with `max_tokens`,
  which every OpenAI-compatible API accepts. The answers are validated by Pydantic anyway.
Every failure raises LlmError with a short reason that can be shown to the manager (AI-01 then falls back
to the local analyzer). The API key is never logged nor returned.
"""

import copy
import json
import logging
import time
from typing import Annotated

import httpx
from fastapi import Depends

from ..config import Settings, get_settings

logger = logging.getLogger("ai-service")

TEMPERATURE = 0.2  # low: the same document should give (almost) the same plan
MAX_COMPLETION_TOKENS = 12_000
CHAT_MAX_COMPLETION_TOKENS = 2_000  # assistant answers are short
# Temporary provider errors ("model overloaded"…) are retried once after a short pause.
TRANSIENT_STATUSES = (500, 502, 503)
RETRY_DELAY_SECONDS = 2.0


class LlmError(Exception):
    """The LLM gave no usable answer."""


def _without_strict(value):
    """Deep copy without the OpenAI-only `strict` flags (tools, json_schema)."""
    if isinstance(value, dict):
        return {key: _without_strict(item) for key, item in value.items() if key != "strict"}
    if isinstance(value, list):
        return [_without_strict(item) for item in value]
    return copy.copy(value)


class OpenAiClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        timeout_seconds: float,
        transport: httpx.BaseTransport | None = None,
        provider: str = "openai",
        provider_label: str = "OpenAI",
    ):
        self.model = model
        self.provider = provider
        # Name shown in messages and warnings ("Google Gemini could not analyse the document…").
        self.label = provider_label
        self.compatible_mode = provider != "openai"
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout_seconds
        self._transport = transport

    def _payload(self, max_tokens: int, **fields) -> dict:
        payload = {"model": self.model, **fields, "temperature": TEMPERATURE}
        if self.compatible_mode:
            payload = _without_strict(payload)
            payload["max_tokens"] = max_tokens
        else:
            payload["max_completion_tokens"] = max_tokens
        return payload

    def _send(self, payload: dict) -> httpx.Response:
        response = self._post(payload)
        if response.status_code in TRANSIENT_STATUSES:
            logger.warning("%s answered HTTP %s: retrying once", self.label, response.status_code)
            time.sleep(RETRY_DELAY_SECONDS)
            response = self._post(payload)
        if response.status_code == 400 and "temperature" in response.text:
            # Some models (reasoning models) only accept their default temperature.
            payload.pop("temperature")
            response = self._post(payload)
        return response

    def complete_json(self, system: str, user: str, schema_name: str, schema: dict) -> dict:
        payload = self._payload(
            MAX_COMPLETION_TOKENS,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
        )
        return self._parse(self._send(payload))

    def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        """One Chat Completions turn with tools (AI-04): the assistant message (content and/or tool_calls)."""
        payload = self._payload(CHAT_MAX_COMPLETION_TOKENS, messages=messages, tools=tools, tool_choice="auto")
        response = self._send(payload)
        self._check_status(response)
        try:
            choice = response.json()["choices"][0]
            message = choice["message"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LlmError("unexpected answer format") from None
        if message.get("refusal"):
            raise LlmError("the model refused to answer")
        if choice.get("finish_reason") == "length":
            raise LlmError("the answer was cut (conversation too long)")
        return message

    def _post(self, payload: dict) -> httpx.Response:
        try:
            with httpx.Client(timeout=self._timeout, transport=self._transport) as client:
                return client.post(self._url, json=payload, headers=self._headers)
        except httpx.TimeoutException:
            raise LlmError(f"no answer within {self._timeout:g} s") from None
        except httpx.HTTPError as exc:
            logger.warning("%s unreachable: %s", self.label, type(exc).__name__)
            raise LlmError(f"{self.label} is unreachable") from None

    def _check_status(self, response: httpx.Response) -> None:
        status = response.status_code
        error = _error_body(response)
        message = str(error.get("message") or "")
        # Google answers 400 INVALID_ARGUMENT "API key not valid" for a wrong key.
        if status in (401, 403) or (status == 400 and "api key not valid" in message.lower()):
            logger.error("%s rejected the API key (HTTP %s): check OPENAI_API_KEY", self.label, status)
            raise LlmError(f"the {self.label} API key was rejected")
        if status == 429:
            code = error.get("code") or error.get("type") or error.get("status")
            logger.warning("%s refused the request (HTTP 429, %s)", self.label, code)
            if "insufficient_quota" in (error.get("type"), error.get("code")):
                raise LlmError(
                    f"the {self.label} account has no credits left (add credits in the {self.label} billing settings)"
                )
            raise LlmError(f"{self.label} rate limit or free quota reached, try again in a moment")
        if status >= 400:
            logger.warning("%s error HTTP %s: %s", self.label, status, message[:300] or response.text[:300])
            raise LlmError(f"{self.label} error {status}")

    def _parse(self, response: httpx.Response) -> dict:
        self._check_status(response)
        try:
            choice = response.json()["choices"][0]
            message = choice["message"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LlmError("unexpected answer format") from None
        if message.get("refusal"):
            raise LlmError("the model refused to analyse the document")
        if choice.get("finish_reason") == "length":
            raise LlmError("the answer was cut (document too long)")
        try:
            content = json.loads(_strip_code_fence(message.get("content") or ""))
        except ValueError:
            raise LlmError("the answer is not valid JSON") from None
        if not isinstance(content, dict):
            raise LlmError("the answer is not a JSON object")
        return content


def _strip_code_fence(text: str) -> str:
    """Some compatible providers wrap JSON in ```json … ``` fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    return text


def _error_body(response: httpx.Response) -> dict:
    """The `error` object of an error answer ({} when absent or unreadable). Google may wrap it in a list."""
    try:
        body = response.json()
    except ValueError:
        return {}
    if isinstance(body, list) and body:
        body = body[0]
    error = body.get("error") if isinstance(body, dict) else None
    return error if isinstance(error, dict) else {}


def get_llm_client(settings: Annotated[Settings, Depends(get_settings)]) -> OpenAiClient | None:
    """None when no OPENAI_API_KEY is configured (the local analyzer is used)."""
    if not settings.llm_enabled:
        return None
    provider, label = settings.llm_provider
    return OpenAiClient(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        base_url=settings.openai_base_url,
        timeout_seconds=settings.llm_timeout_seconds,
        provider=provider,
        provider_label=label,
    )
