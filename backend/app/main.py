"""FastAPI 앱 진입점."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routers import auth, create, cron, debates, empathy, predictions, results, share, stage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agora")

# 문자열 detail(FastAPI 기본 404/405 등)을 공통 에러 모양으로 바꿀 때 쓰는 코드·문구
_DEFAULT_ERRORS = {
    404: ("not_found", "찾는 주소가 없어요."),
    405: ("method_not_allowed", "지원하지 않는 요청이에요."),
}


def _error_body(code: str, message: str) -> dict:
    return {"detail": {"code": code, "message": message}}


def _install_error_handlers(app: FastAPI) -> None:
    """모든 에러를 {"detail": {"code", "message"}} 모양으로 맞춘다(api-list.md 공통 규약)."""

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict):
            body = {"detail": exc.detail}
        else:
            code, message = _DEFAULT_ERRORS.get(exc.status_code, ("error", "요청을 처리하지 못했어요."))
            body = _error_body(code, message)
        return JSONResponse(body, status_code=exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        # 내부 정보(스택·메시지)는 로그에만 남기고 응답에는 넣지 않는다.
        logger.exception("처리 못 한 오류: %s %s", request.method, request.url.path)
        return JSONResponse(_error_body("internal", "잠시 후 다시 시도해 주세요."), status_code=500)


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
    _install_error_handlers(app)

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True}

    app.include_router(auth.router)
    app.include_router(create.router)  # /api/debates/similar가 /api/debates/{id}보다 먼저
    app.include_router(debates.router)
    app.include_router(stage.router)
    app.include_router(predictions.router)
    app.include_router(empathy.router)
    app.include_router(results.router)
    app.include_router(share.router)
    app.include_router(cron.router)

    return app


app = create_app()
