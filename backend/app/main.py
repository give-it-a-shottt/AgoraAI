"""FastAPI 앱 진입점."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Agora AI API",
        docs_url=None if settings.is_production else "/api/docs",
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Browser-Id"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True}

    return app


app = create_app()
