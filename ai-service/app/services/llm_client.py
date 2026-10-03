"""OpenAI Chat Completions client with structured outputs (JSON schema, strict mode).

Every failure raises LlmError with a short reason that can be shown to the manager; the caller then
falls back to the local analyzer. The API key is never logged nor returned.
"""

import json
import logging
from typing import Annotated

import httpx
from fastapi import Depends

from ..config import Settings, get_settings

logger = logging.getLogger("ai-service")

TEMPERATURE = 0.2  # low: the same document should give (almost) the same plan
MAX_COMPLETION_TOKENS = 12_000


class LlmError(Exception):
    """The LLM gave no usable answer."""


class OpenAiClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        timeout_seconds: float,
        transport: httpx.BaseTransport | None = None,
    ):
        self.model = model
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout_seconds
        self._transport = transport

    def complete_json(self, system: str, user: str, schema_name: str, schema: dict) -> dict:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
            "temperature": TEMPERATURE,
            "max_completion_tokens": MAX_COMPLETION_TOKENS,
        }
        response = self._post(payload)
        if response.status_code == 400 and "temperature" in response.text:
            # Some models (reasoning models) only accept their default temperature.
            payload.pop("temperature")
            response = self._post(payload)
        return self._parse(response)

    def _post(self, payload: dict) -> httpx.Response:
        try:
            with httpx.Client(timeout=self._timeout, transport=self._transport) as client:
                return client.post(self._url, json=payload, headers=self._headers)
        except httpx.TimeoutException:
            raise LlmError(f"no answer within {self._timeout:g} s") from None
        except httpx.HTTPError as exc:
            logger.warning("OpenAI unreachable: %s", type(exc).__name__)
            raise LlmError("OpenAI is unreachable") from None

    def _parse(self, response: httpx.Response) -> dict:
        status = response.status_code
        if status in (401, 403):
            logger.error("OpenAI rejected the API key (HTTP %s): check OPENAI_API_KEY", status)
            raise LlmError("the OpenAI API key was rejected")
        if status == 429:
            raise LlmError("OpenAI rate limit or quota exceeded")
        if status >= 400:
            logger.warning("OpenAI error HTTP %s: %s", status, _error_message(response))
            raise LlmError(f"OpenAI error {status}")
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
            content = json.loads(message.get("content") or "")
        except ValueError:
            raise LlmError("the answer is not valid JSON") from None
        if not isinstance(content, dict):
            raise LlmError("the answer is not a JSON object")
        return content


def _error_message(response: httpx.Response) -> str:
    try:
        return str(response.json()["error"]["message"])[:300]
    except (ValueError, KeyError, TypeError):
        return response.text[:300]


def get_llm_client(settings: Annotated[Settings, Depends(get_settings)]) -> OpenAiClient | None:
    """None when no OPENAI_API_KEY is configured (the local analyzer is used)."""
    if not settings.llm_enabled:
        return None
    return OpenAiClient(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        base_url=settings.openai_base_url,
        timeout_seconds=settings.llm_timeout_seconds,
    )
