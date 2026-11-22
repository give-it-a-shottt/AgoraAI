"""F-003 승부 예측: 1회만, 브라우저 번호 검증, 가려진 토론."""

from tests.conftest import BROWSER
from tests.factories import make_debate


def test_predict_once_and_read_back(client, db):
    d = make_debate(db)
    assert client.get(f"/api/debates/{d.id}/predictions/me").json() == {"pick": None}
    assert client.post(f"/api/debates/{d.id}/predictions", json={"pick": "B"}).json() == {"pick": "B"}
    # 다시 보내도 처음 예측 유지
    assert client.post(f"/api/debates/{d.id}/predictions", json={"pick": "A"}).json() == {"pick": "B"}
    assert client.get(f"/api/debates/{d.id}/predictions/me").json() == {"pick": "B"}
    assert client.get(f"/api/debates/{d.id}").json()["prediction_count"] == 1


def test_other_browser_counts_separately(client, db):
    d = make_debate(db)
    client.post(f"/api/debates/{d.id}/predictions", json={"pick": "A"})
    other = {"X-Browser-Id": "22222222-2222-4222-8222-222222222222"}
    assert client.post(f"/api/debates/{d.id}/predictions", json={"pick": "B"}, headers=other).json() == {"pick": "B"}
    assert client.get(f"/api/debates/{d.id}").json()["prediction_count"] == 2


def test_browser_id_required(client, db):
    d = make_debate(db)
    for bad in ("", "not-a-uuid"):
        res = client.post(f"/api/debates/{d.id}/predictions", json={"pick": "A"}, headers={"X-Browser-Id": bad})
        assert res.status_code == 400
        assert res.json()["detail"]["code"] == "browser_id_required"
    assert BROWSER  # 기본 헤더는 conftest에서 유효한 값


def test_predict_validation_and_missing(client, db):
    d = make_debate(db)
    assert client.post(f"/api/debates/{d.id}/predictions", json={"pick": "C"}).status_code == 422
    assert client.post("/api/debates/nope/predictions", json={"pick": "A"}).status_code == 404
    h = make_debate(db, "가린", "토론", hidden=True)
    assert client.post(f"/api/debates/{h.id}/predictions", json={"pick": "A"}).status_code == 410


def test_concurrent_duplicate_returns_first_pick(db, monkeypatch):
    """다른 요청이 먼저 저장한 직후(선행 조회는 못 본 상태)에도 처음 값을 돌려준다."""
    from app.models import Prediction
    from app.services import audience

    d = make_debate(db)
    db.add(Prediction(debate_id=d.id, browser_id=BROWSER, pick="A"))
    db.commit()
    real = audience.my_prediction
    calls = {"n": 0}

    def first_blind(*args):
        calls["n"] += 1
        return None if calls["n"] == 1 else real(*args)

    monkeypatch.setattr(audience, "my_prediction", first_blind)
    assert audience.predict(db, d.id, BROWSER, "B", "client") == "A"
    assert db.query(Prediction).filter_by(debate_id=d.id).count() == 1  # 세션도 정상


def test_prediction_rate_limit_per_client(client, db, monkeypatch):
    from app.services import throttle

    monkeypatch.setattr(throttle, "PREDICTION_LIMIT", throttle.Limit(2, throttle.timedelta(minutes=10)))
    debates = [make_debate(db, f"a{i}", f"b{i}") for i in range(3)]
    ids = [f"44444444-4444-4444-8444-44444444444{i}" for i in range(3)]
    for d, b in zip(debates[:2], ids[:2]):
        assert client.post(f"/api/debates/{d.id}/predictions", json={"pick": "A"}, headers={"X-Browser-Id": b}).status_code == 200
    res = client.post(f"/api/debates/{debates[2].id}/predictions", json={"pick": "A"}, headers={"X-Browser-Id": ids[2]})
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "too_many_requests" and res.json()["detail"]["retry_after"] > 0
    # 이미 한 예측을 다시 읽는 것은 제한하지 않는다
    again = client.post(f"/api/debates/{debates[0].id}/predictions", json={"pick": "B"}, headers={"X-Browser-Id": ids[0]})
    assert again.json() == {"pick": "A"}


def test_client_hash_hides_ip():
    from app.services.throttle import client_hash

    h = client_hash("203.0.113.7", "secret")
    assert "203" not in h and len(h) == 32
    assert h != client_hash("203.0.113.7", "other-secret")
