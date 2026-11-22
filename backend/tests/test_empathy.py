"""F-004 공감: 발언당 브라우저 1번, 목록 API에 반영, 가려진 토론."""

from app.models import Utterance
from tests.factories import make_debate


def _first_utterance(db, debate):
    return db.query(Utterance).filter_by(debate_id=debate.id, seq=1).one()


def test_empathy_once_per_browser(client, db):
    d = make_debate(db, utterances=2)
    u = _first_utterance(db, d)
    assert client.post(f"/api/utterances/{u.id}/empathy").json() == {"count": 1, "empathized": True}
    assert client.post(f"/api/utterances/{u.id}/empathy").json()["count"] == 1
    other = {"X-Browser-Id": "33333333-3333-4333-8333-333333333333"}
    assert client.post(f"/api/utterances/{u.id}/empathy", headers=other).json()["count"] == 2
    items = client.get(f"/api/debates/{d.id}/utterances").json()["items"]
    assert items[0]["empathy_count"] == 2 and items[1]["empathy_count"] == 0


def test_empathy_errors(client, db):
    assert client.post("/api/utterances/999/empathy").status_code == 404
    assert client.post("/api/utterances/0/empathy").status_code == 422
    h = make_debate(db, hidden=True, utterances=1)
    assert client.post(f"/api/utterances/{_first_utterance(db, h).id}/empathy").status_code == 410
    d = make_debate(db, "a", "b", utterances=1)
    res = client.post(f"/api/utterances/{_first_utterance(db, d).id}/empathy", headers={"X-Browser-Id": "x"})
    assert res.status_code == 400


def test_empathy_rate_limit(client, db, monkeypatch):
    from app.services import throttle

    monkeypatch.setattr(throttle, "EMPATHY_LIMIT", throttle.Limit(1, throttle.timedelta(minutes=10)))
    d = make_debate(db, utterances=2)
    u1 = _first_utterance(db, d)
    u2 = db.query(Utterance).filter_by(debate_id=d.id, seq=2).one()
    assert client.post(f"/api/utterances/{u1.id}/empathy").status_code == 200
    assert client.post(f"/api/utterances/{u1.id}/empathy").status_code == 200  # 이미 한 공감 재요청은 그대로
    assert client.post(f"/api/utterances/{u2.id}/empathy").status_code == 429
