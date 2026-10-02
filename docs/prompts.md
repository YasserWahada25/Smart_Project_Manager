# LLM Prompts

> Current state: **no LLM is used yet and no prompt exists.**
> An external LLM API is introduced only when explicitly requested. Prompts are documented here exactly as they appear in the code (`ai-service/app/prompts/`).

## Template (one section per LLM feature)

### Feature: `<AI-xx name>`

| Item | Value |
|------|-------|
| Provider / model | |
| Endpoint | |
| Timeout | |

**System prompt**

```text
(exact system prompt)
```

**User prompt structure**

```text
(template with placeholders)
```

**Input** — fields received from the backend.

**Expected output — JSON schema**

```json
{}
```

**Validation** — how the response is parsed and validated (Pydantic schema, enum checks, bounds).

**Error handling** — malformed JSON, schema mismatch, timeout, provider error, rate limit.

**Security considerations** — API key handling, prompt-injection mitigation, data sent to the provider.

## Implemented prompts

None yet.
