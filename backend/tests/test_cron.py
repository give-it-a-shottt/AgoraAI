"""F-008 오늘의 토론 cron: 비밀 헤더, 하루 한 번, 주제 목록 → 인기 토론 올리기."""

import pytest

from app.config import get_settings
from app.models import Debate
from app.services import today
from app.timeutil import kst_today
from tests.factories import make_debate

SECRET = "cron-test-secret"
AUTH = {"Authorization": f"Bearer {SECRET}"}


@pytest.fixture
def cron_secret(monkeypatch):
    monkeypatch.setattr(get_settings(), "cron_secret", SECRET)


def test_cron_requires_configured_secret(client):
    # 비밀값이 비어 있으면 빈 헤더로도 통과하지 않는다
    assert client.get("/api/cron/today").status_code == 503
    assert client.get("/api/cron/today", headers={"Authorization": "Bearer "}).status_code == 503


@pytest.mark.usefixtures("cron_secret")
@pytest.mark.parametrize("header", [None, "Bearer wrong", SECRET, f"bearer {SECRET}x"])
def test_cron_rejects_wrong_secret(client, header):
    headers = {"Authorization": header} if header else {}
    res = client.get("/api/cron/today", headers=headers)
    assert res.status_code == 401 and res.json()["detail"]["code"] == "unauthorized"


@pytest.mark.usefixtures("cron_secret")
def test_cron_creates_today_from_pool_once(client, db):
    first = client.get("/api/cron/today", headers=AUTH).json()
    assert first["source"] == "pool" and first["created"] is True
    db.expire_all()
    debate = db.get(Debate, first["debate_id"])
    assert debate.today_date == kst_today() and debate.creator_id is None
    assert (debate.topic_a, debate.topic_b) == today.TODAY_TOPICS[0]
    assert debate.status == "done"  # 백그라운드 생성(mock)
    again = client.get("/api/cron/today", headers=AUTH).json()
    assert again == {"debate_id": first["debate_id"], "source": "existing", "created": False}
    assert client.get("/api/debates/today").json()["id"] == first["debate_id"]


@pytest.mark.usefixtures("cron_secret")
def test_cron_skips_used_topics_then_promotes_most_predicted(client, db, monkeypatch):
    a, b = today.TODAY_TOPICS[0]
    make_debate(db, b, a)  # 순서만 바뀐 같은 주제는 이미 있음
    res = client.get("/api/cron/today", headers=AUTH).json()
    assert res["source"] == "pool"
    db.expire_all()
    assert (db.get(Debate, res["debate_id"]).topic_a, db.get(Debate, res["debate_id"]).topic_b) == today.TODAY_TOPICS[1]


def test_promotes_most_predicted_unfeatured_when_pool_is_used(db, monkeypatch):
    monkeypatch.setattr(today, "TODAY_TOPICS", [])
    make_debate(db, "덜 인기", "주제", predictions=1)
    popular = make_debate(db, "인기", "주제", predictions=5)
    make_debate(db, "가려진", "주제", predictions=9, hidden=True)
    make_debate(db, "이미 걸렸던", "주제", predictions=9, today_date=kst_today().replace(year=2020))
    result = today.ensure_today(db)
    assert result.source == "promoted" and result.debate.id == popular.id and not result.created
    db.refresh(popular)
    assert popular.today_date == kst_today()


def test_second_call_same_day_never_creates_twice(db):
    """두 번째 호출이 자리를 못 잡으면 만들지 않는다(같은 날 cron 재시도)."""
    first = today.ensure_today(db)
    first.debate.is_hidden = True  # 오늘 토론이 가려져 current_today가 비어도
    db.commit()
    second = today.ensure_today(db)
    assert second.created is False and second.debate is None
    assert db.query(Debate).count() == 1
