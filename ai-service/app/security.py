"""Only the Express backend may call the AI routes: it sends the shared secret
`AI_SERVICE_TOKEN` in the `X-AI-Service-Token` header."""

import hmac
from typing import Annotated

from fastapi import Depends, Header

from .config import Settings, get_settings
from .errors import ApiError


def require_backend_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_ai_service_token: Annotated[str | None, Header()] = None,
) -> None:
    # Constant-time comparison (no timing leak on the secret).
    if not x_ai_service_token or not hmac.compare_digest(
        x_ai_service_token.encode(), settings.ai_service_token.encode()
    ):
        raise ApiError(401, "Invalid or missing service token")
