"""AI-04 — one turn of the manager assistant (stateless).

The backend sends the whole conversation of the current exchange (user / assistant messages, previous
tool calls and their results); this service adds the system prompt and the tools, calls OpenAI, and
returns either the final answer or the tool calls the model wants, with their arguments validated
(`error` is set when they do not match the tool schema, so the backend can report it to the model).
"""

import json
import logging

from pydantic import ValidationError

from ..errors import ApiError
from ..prompts.assistant import TOOLS, build_system_prompt
from ..schemas.assistant import TOOL_ARGUMENTS, ChatRequest, ChatResponse, ToolCall
from .llm_client import LlmError, OpenAiClient

logger = logging.getLogger("ai-service")

MAX_TOOL_CALLS = 10


def to_openai_messages(request: ChatRequest) -> list[dict]:
    system = build_system_prompt(request.project, request.today.isoformat())
    messages: list[dict] = [{"role": "system", "content": system}]
    for message in request.messages:
        if message.role == "tool":
            messages.append({"role": "tool", "tool_call_id": message.toolCallId or "", "content": message.content})
        elif message.role == "assistant" and message.toolCalls:
            messages.append({
                "role": "assistant",
                "content": message.content or None,
                "tool_calls": [
                    {"id": call.id, "type": "function",
                     "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False)}}
                    for call in message.toolCalls
                ],
            })
        else:
            messages.append({"role": message.role, "content": message.content})
    return messages


def validate_call(call_id: str, name: str, raw_arguments: str) -> ToolCall:
    schema = TOOL_ARGUMENTS.get(name)
    if schema is None:
        return ToolCall(id=call_id, name=name, error=f"Unknown tool: {name}")
    try:
        arguments = json.loads(raw_arguments or "{}")
    except ValueError:
        return ToolCall(id=call_id, name=name, error="The arguments are not valid JSON")
    if not isinstance(arguments, dict):
        return ToolCall(id=call_id, name=name, error="The arguments must be a JSON object")
    try:
        parsed = schema.model_validate(arguments)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc']) or 'arguments'}: {error['msg']}"
            for error in exc.errors()[:5]
        )
        return ToolCall(id=call_id, name=name, arguments=arguments, error=f"Invalid arguments: {details}")
    # Dates back to ISO strings; unset (null) values are dropped.
    return ToolCall(id=call_id, name=name, arguments=parsed.model_dump(mode="json", exclude_none=True))


def chat(request: ChatRequest, llm: OpenAiClient) -> ChatResponse:
    try:
        message = llm.chat(to_openai_messages(request), TOOLS)
    except LlmError as exc:
        logger.warning("Assistant: OpenAI failed (%s)", exc)
        raise ApiError(502, f"The assistant could not answer: {exc}") from None
    raw_calls = message.get("tool_calls") or []
    content = (message.get("content") or "").strip()
    if not raw_calls:
        if not content:
            raise ApiError(502, "The assistant could not answer: empty answer")
        return ChatResponse(type="message", content=content, toolCalls=[], model=llm.model)
    calls = []
    for raw in raw_calls[:MAX_TOOL_CALLS]:
        function = raw.get("function") or {}
        calls.append(validate_call(str(raw.get("id") or ""), str(function.get("name") or ""),
                                   function.get("arguments") or "{}"))
    return ChatResponse(type="tool_calls", content=content, toolCalls=calls, model=llm.model)
