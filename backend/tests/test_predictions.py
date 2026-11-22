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
