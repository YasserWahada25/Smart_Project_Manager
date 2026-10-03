"""Errors in the same JSON format as the Express backend:
`{"error": {"status", "code", "message", "details"}}`."""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("ai-service")

_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "UNPROCESSABLE_ENTITY",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
}


class ApiError(Exception):
    def __init__(self, status_code: int, message: str, details: list[dict] | None = None, code: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.details = details or []
        self.code = code or _CODES.get(status_code, "ERROR")


def error_body(status_code: int, code: str, message: str, details: list[dict] | None = None) -> dict:
    return {"error": {"status": status_code, "code": code, "message": message, "details": details or []}}


def _field(location: tuple) -> str:
    """`("body", "options", "sprintLengthDays")` → `options.sprintLengthDays`."""
    parts = [str(part) for part in location if part not in ("body", "query", "path")]
    return ".".join(parts) or "body"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        body = error_body(exc.status_code, exc.code, exc.message, exc.details)
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": _field(err["loc"]), "message": err["msg"]} for err in exc.errors()]
        return JSONResponse(status_code=400, content=error_body(400, "BAD_REQUEST", "Validation failed", details))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _CODES.get(exc.status_code, "ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            message = "Route not found"
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.status_code, code, message))

    @app.exception_handler(Exception)
    async def unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        # Never leak internal details to the caller.
        logger.exception("Unexpected error: %s", exc)
        return JSONResponse(status_code=500, content=error_body(500, "INTERNAL_ERROR", "Internal server error"))
