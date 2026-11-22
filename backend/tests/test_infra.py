"""F-000 공통 기반 테스트: 에러 모양, DB URL 변환, 운영 설정 검증, 마이그레이션."""

import pytest
from alembic.config import Config
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from alembic import command
from app.config import Settings
from app.db import normalize_url
from app.errors import api_error
from app.main import create_app

EXPECTED_TABLES = {"users", "debates", "utterances", "predictions", "empathies", "reports"}


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgres://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgresql://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("sqlite:///./agora.db", "sqlite:///./agora.db"),
    ],
)
def test_normalize_url(raw, expected):
    assert normalize_url(raw) == expected


def _client_with_route(route):
    app = create_app()
    router = APIRouter()
    router.add_api_route("/api/_test", route, methods=["GET"])
    app.include_router(router)
    return TestClient(app, raise_server_exceptions=False)


def test_api_error_shape():
    def boom():
        raise api_error(409, "already", "이미 했어요.", extra_field=1)

    res = _client_with_route(boom).get("/api/_test")
    assert res.status_code == 409
    assert res.json() == {"detail": {"code": "already", "message": "이미 했어요.", "extra_field": 1}}


def test_unknown_path_and_method_use_common_shape(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "not_found"
    res = client.delete("/api/health")
    assert res.status_code == 405
    assert res.json()["detail"]["code"] == "method_not_allowed"


def test_unexpected_error_hides_internals():
    def crash():
        raise RuntimeError("secret internal detail")

    res = _client_with_route(crash).get("/api/_test")
    assert res.status_code == 500
    assert res.json() == {"detail": {"code": "internal", "message": "잠시 후 다시 시도해 주세요."}}
    assert "secret" not in res.text


def test_production_rejects_dev_secrets():
    with pytest.raises(ValueError, match="SESSION_SECRET"):
        Settings(app_env="production", database_url="postgresql://x/y", cron_secret="c")
    with pytest.raises(ValueError, match="CRON_SECRET"):
        Settings(app_env="production", database_url="postgresql://x/y", session_secret="s" * 40)
    ok = Settings(
        app_env="production", database_url="postgresql://x/y", session_secret="s" * 40, cron_secret="c"
    )
    assert ok.is_production


def test_empty_env_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "")
    assert Settings().session_secret == "dev-only-change-me"


def test_migration_creates_all_tables_and_matches_models(tmp_path, monkeypatch):
    """완료 기준 ⑤: 마이그레이션 한 번으로 표 6개가 생기고, 모델과 차이가 없어야 한다."""
    url = f"sqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    from app.config import get_settings

    get_settings.cache_clear()
    try:
        cfg = Config("alembic.ini")
        command.upgrade(cfg, "head")
        tables = set(inspect(create_engine(url)).get_table_names()) - {"alembic_version"}
        assert tables == EXPECTED_TABLES
        command.check(cfg)  # autogenerate 차이가 있으면 예외
    finally:
        get_settings.cache_clear()
