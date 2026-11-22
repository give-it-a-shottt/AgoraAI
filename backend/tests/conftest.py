import os

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"
for key in ("HYPERCLOVA_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "GOOGLE_CLIENT_ID", "KAKAO_REST_KEY"):
    os.environ[key] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import db as db_module  # noqa: E402
from app.db import Base  # noqa: E402
from app.main import create_app  # noqa: E402

BROWSER = "11111111-1111-4111-8111-111111111111"


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session_factory(engine, monkeypatch):
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    # 백그라운드 작업도 같은 테스트 DB를 쓰게 한다.
    monkeypatch.setattr(db_module, "SessionLocal", factory)
    return factory


@pytest.fixture
def db(session_factory):
    s = session_factory()
    yield s
    s.close()


@pytest.fixture
def client(session_factory):
    app = create_app()

    def _get_db():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[db_module.get_db] = _get_db
    with TestClient(app) as c:
        c.headers.update({"X-Browser-Id": BROWSER})
        yield c
