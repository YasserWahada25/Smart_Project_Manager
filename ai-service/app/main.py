"""FastAPI application. Run with: `uvicorn app.main:app --port 8000` (from ai-service/)."""

import logging

from fastapi import FastAPI

from .config import get_settings
from .errors import register_error_handlers
from .routes import health, planning


def create_app() -> FastAPI:
    settings = get_settings()  # fails fast on an invalid configuration
    logging.basicConfig(level=settings.log_level.upper(), format="[%(asctime)s] %(levelname)s %(message)s")

    app = FastAPI(
        title="Smart Project Manager — AI service",
        version="0.2.0",
        description="Internal API called by the Express backend only.",
    )
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(planning.router)
    return app


app = create_app()
