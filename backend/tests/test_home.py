"""F-001 홈: 오늘의 토론, 인기·최신 목록, 승자 비노출."""

from datetime import timedelta

from app.timeutil import kst_today, utcnow
from tests.factories import make_debate


def test_today_returns_today_debate_without_winner(client, db):
    make_debate(db, "산", "바다", today_date=kst_today() - timedelta(days=1))
    today = make_debate(db, "짜장", "짬뽕", today_date=kst_today(), predictions=3)
    res = client.get("/api/debates/today")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == today.id
    assert body["prediction_count"] == 3
    assert "winner" not in body
    assert {c["character"] for c in body["cast"]} == {"cat", "penguin"}


def test_today_falls_back_to_latest_done(client, db):
    make_debate(db, "산", "바다", status="generating")
    done = make_debate(db, "여름", "겨울")
    assert client.get("/api/debates/today").json()["id"] == done.id


def test_today_404_when_empty(client):
    res = client.get("/api/debates/today")
    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "no_today"


def test_list_popular_and_latest_order(client, db):
    now = utcnow()
    make_debate(db, "카드", "토론", today_date=kst_today())
    old_popular = make_debate(db, "a1", "b1", predictions=5, created_at=now - timedelta(days=3))
    new_quiet = make_debate(db, "a2", "b2", predictions=1, created_at=now)
    popular = client.get("/api/debates?sort=popular").json()
    latest = client.get("/api/debates?sort=latest").json()
    assert [d["id"] for d in popular["items"]] == [old_popular.id, new_quiet.id]
    assert [d["id"] for d in latest["items"]] == [new_quiet.id, old_popular.id]
    assert all("winner" not in d for d in popular["items"])


def test_list_excludes_hidden_and_featured_today(client, db):
    make_debate(db, "숨김", "토론", hidden=True)
    make_debate(db, "오늘", "토론", today_date=kst_today())
    visible = make_debate(db, "보임", "토론")
    body = client.get("/api/debates").json()
    assert [d["id"] for d in body["items"]] == [visible.id]
    assert body["total"] == 1


def test_list_pagination(client, db):
    make_debate(db, "카드", "토론", today_date=kst_today())
    for i in range(7):
        make_debate(db, f"a{i}", f"b{i}")
    page2 = client.get("/api/debates?sort=latest&page=2&size=5").json()
    assert page2["page"] == 2
    assert page2["total_pages"] == 2
    assert len(page2["items"]) == 2


def test_list_rejects_bad_params(client):
    assert client.get("/api/debates?sort=weird").status_code == 422
    assert client.get("/api/debates?page=0").status_code == 422
    assert client.get("/api/debates?size=50").status_code == 422


def test_detail_and_hidden(client, db):
    d = make_debate(db, utterances=2, predictions=1)
    body = client.get(f"/api/debates/{d.id}").json()
    assert body["hidden"] is False
    assert body["utterance_count"] == 2
    assert "winner" not in body
    h = make_debate(db, "가림", "토론", hidden=True, utterances=2)
    hb = client.get(f"/api/debates/{h.id}").json()
    assert hb["hidden"] is True and hb["utterance_count"] == 0
    assert client.get("/api/debates/nope").json()["detail"]["code"] == "not_found"


def test_featured_fallback_is_not_listed_again(client, db):
    """대체로 뽑힌 카드 토론(어제의 오늘의 토론)도 목록에서 빠진다."""
    featured = make_debate(db, "어제", "토론", today_date=kst_today() - timedelta(days=1))
    other = make_debate(db, "다른", "토론")
    assert client.get("/api/debates/today").json()["id"] == featured.id
    assert [d["id"] for d in client.get("/api/debates").json()["items"]] == [other.id]


def test_only_generating_debates_still_show_on_home(client, db):
    """완료된 토론이 하나도 없어도 진행 중 토론이 있으면 빈 상태가 아니다(완료 기준 ⑥)."""
    live = make_debate(db, "생성", "중", status="generating", winner=None)
    assert client.get("/api/debates/today").json()["id"] == live.id


def test_hidden_and_future_today_are_not_featured(client, db):
    make_debate(db, "가린", "오늘", today_date=kst_today(), hidden=True)
    make_debate(db, "내일", "토론", today_date=kst_today() + timedelta(days=1))
    done = make_debate(db, "완료", "토론")
    assert client.get("/api/debates/today").json()["id"] == done.id


def test_page_beyond_range_and_bounds(client, db):
    make_debate(db, "하나", "뿐")
    make_debate(db, "카드", "토론", today_date=kst_today())
    far = client.get("/api/debates?page=999").json()
    assert far["items"] == [] and far["total_pages"] == 1
    assert client.get("/api/debates?size=0").status_code == 422
    assert client.get("/api/debates?page=1001").status_code == 422


def test_latest_counts_predictions_per_item(client, db):
    make_debate(db, "카드", "토론", today_date=kst_today())
    d = make_debate(db, "예측", "많음", predictions=4)
    item = client.get("/api/debates?sort=latest").json()["items"][0]
    assert item["id"] == d.id and item["prediction_count"] == 4


def test_detail_id_too_long_is_rejected(client):
    assert client.get("/api/debates/" + "x" * 40).status_code == 422
