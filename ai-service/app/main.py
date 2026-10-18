"""FastAPI application. Run with: `uvicorn app.main:app --port 8000` (from ai-service/)."""

import logging

from fastapi import FastAPI

from .config import get_settings
from .errors import register_error_handlers
<<<<<<< HEAD
from .routes import assistant, health, planning, recommendation, risk
=======
from .routes import assistant, health, planning, recommendation, retrospective, risk
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b


def create_app() -> FastAPI:
    settings = get_settings()  # fails fast on an invalid configuration
    logging.basicConfig(level=settings.log_level.upper(), format="[%(asctime)s] %(levelname)s %(message)s")

    app = FastAPI(
        title="Smart Project Manager — AI service",
<<<<<<< HEAD
        version="0.5.0",
=======
        version="0.6.0",
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
        description="Internal API called by the Express backend only.",
    )
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(planning.router)
    app.include_router(recommendation.router)
    app.include_router(risk.router)
    app.include_router(assistant.router)
<<<<<<< HEAD
=======
    app.include_router(retrospective.router)
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
    return app


app = create_app()
