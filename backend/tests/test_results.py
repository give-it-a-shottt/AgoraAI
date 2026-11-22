"""F-005 결과·심판·지표·신고."""

import pytest

from app.models import Debate, Prediction, Utterance
from app.providers.base import JudgeResult, ProviderError
from app.services import generation, judging
from tests.conftest import BROWSER
from tests.factories import make_debate


class FixedJudge:
    def __init__(self, fail=False):
        self.fail = fail
        self.calls = 0

    def judge(self, topic_a, topic_b, turns):
        self.calls += 1
        if self.fail:
            raise ProviderError("심판 실패")
        return JudgeResult(winner="B", reason="B가 더 구체적이었어요.", stances=["neutral", "rebut", "rebut", "agree", "rebut"])


@pytest.fixture
def use_judge(monkeypatch):
    def _use(j):
        monkeypatch.setattr(judging, "judge_provider", lambda: j)
        return j

    return _use


def _finished(db, **kw):
    return make_debate(db, utterances=6, winner=None, **kw)


def test_compute_rates():
    assert judging.compute_rates(["rebut", "rebut", "agree", "neutral"]) == (0.5, 0.25)
    assert judging.compute_rates([]) == (0.0, 0.0)


def test_judge_sets_winner_rates_and_stances(db, use_judge):
    use_judge(FixedJudge())
    d = _finished(db)
    assert judging.judge_debate(d.id) == "done"
    db.expire_all()
    debate = db.get(Debate, d.id)
    assert debate.winner == "B" and debate.judge_status == "done"
    assert debate.rebut_rate == pytest.approx(0.6) and debate.agree_rate == pytest.approx(0.2)
    labels = [u.stance_label for u in db.query(Utterance).filter_by(debate_id=d.id).order_by(Utterance.seq)]
    assert labels == [None, "neutral", "rebut", "rebut", "agree", "rebut"]
    assert debate.lock_until is None


def test_judge_failure_marks_failed(db, use_judge):
    use_judge(FixedJudge(fail=True))
    d = _finished(db)
    assert judging.judge_debate(d.id) == "failed"
    db.expire_all()
    assert db.get(Debate, d.id).winner is None


def test_generation_judges_when_finished(db, use_judge):
    judge = use_judge(FixedJudge())
    d = generation.create_debate(db, "산", "바다")
    generation.run_until_done(d.id)
    db.expire_all()
    assert db.get(Debate, d.id).judge_status == "done" and judge.calls == 1


def test_result_requires_finished(client, db):
    d = make_debate(db, status="generating", winner=None, utterances=3)
    res = client.get(f"/api/debates/{d.id}/result")
    assert res.status_code == 409 and res.json()["detail"]["code"] == "not_finished"


def test_result_hides_winner_until_judged_and_shows_my_prediction(client, db, use_judge):
    use_judge(FixedJudge(fail=True))
    d = _finished(db)
    db.add(Prediction(debate_id=d.id, browser_id=BROWSER, pick="B"))
    db.commit()
    body = client.get(f"/api/debates/{d.id}/result").json()
    # 판정 전(pending)에는 승자 없음. 응답 뒤 백그라운드 판정이 실패로 끝남
    assert body["winner"] is None and body["my_prediction"] == "B"
    assert body["metrics"]["human_agreement"] is None
    after = client.get(f"/api/debates/{d.id}/result").json()
    assert after["judge_status"] == "failed" and after["winner"] is None


def test_result_after_judge(client, db, use_judge):
    use_judge(FixedJudge())
    d = _finished(db)
    judging.judge_debate(d.id)
    body = client.get(f"/api/debates/{d.id}/result", headers={"X-Browser-Id": ""}).json()
    assert body["judge_status"] == "done" and body["winner"] == "B"
    assert body["judge_reason"] == "B가 더 구체적이었어요."
    assert body["my_prediction"] is None  # 브라우저 번호가 없어도 결과는 본다
    assert body["metrics"]["rebut_rate"] == pytest.approx(0.6)


def test_audience_shown_only_from_five(client, db, use_judge):
    use_judge(FixedJudge())
    d = _finished(db, predictions=4)
    judging.judge_debate(d.id)
    assert client.get(f"/api/debates/{d.id}/result").json()["audience"] == {"count": 4, "a_ratio": None, "b_ratio": None}
    db.add(Prediction(debate_id=d.id, browser_id="b-extra", pick="B"))
    db.commit()
    audience = client.get(f"/api/debates/{d.id}/result").json()["audience"]
    assert audience["count"] == 5 and audience["a_ratio"] == pytest.approx(0.8) and audience["b_ratio"] == pytest.approx(0.2)


def test_judge_retry_rules(client, db, use_judge):
    judge = use_judge(FixedJudge(fail=True))
    d = _finished(db)
    judging.judge_debate(d.id)
    judge.fail = False
    res = client.post(f"/api/debates/{d.id}/judge/retry")
    assert res.status_code == 200 and res.json()["winner"] == "B"
    again = client.post(f"/api/debates/{d.id}/judge/retry")
    assert again.status_code == 409 and again.json()["detail"]["code"] == "not_failed"


def test_judge_retry_limit(client, db, use_judge):
    use_judge(FixedJudge(fail=True))
    d = _finished(db)
    d.judge_status, d.judge_attempts = "failed", judging.MAX_JUDGE_ATTEMPTS
    db.commit()
    res = client.post(f"/api/debates/{d.id}/judge/retry")
    assert res.status_code == 409 and res.json()["detail"]["code"] == "judge_limit"


def test_reports_hide_after_three(client, db):
    d = make_debate(db)
    browsers = [f"5555555{i}-5555-4555-8555-555555555555" for i in range(3)]
    for i, b in enumerate(browsers):
        body = client.post(f"/api/debates/{d.id}/reports", json={"reason": "hate"}, headers={"X-Browser-Id": b}).json()
        assert body == {"reported": True, "hidden": i == 2}
    assert client.get(f"/api/debates/{d.id}").json()["hidden"] is True
    assert client.get("/api/debates").json()["total"] == 0


def test_report_once_per_browser_and_validation(client, db):
    d = make_debate(db)
    for _ in range(3):
        assert client.post(f"/api/debates/{d.id}/reports", json={"reason": "other"}).json()["hidden"] is False
    assert client.post(f"/api/debates/{d.id}/reports", json={"reason": "spam"}).status_code == 422


def test_report_rate_limit(client, db, monkeypatch):
    from app.services import throttle

    monkeypatch.setattr(throttle, "REPORT_LIMIT", throttle.Limit(1, throttle.timedelta(hours=1)))
    a, b = make_debate(db, "a1", "b1"), make_debate(db, "a2", "b2")
    assert client.post(f"/api/debates/{a.id}/reports", json={"reason": "hate"}).status_code == 200
    res = client.post(f"/api/debates/{b.id}/reports", json={"reason": "hate"})
    assert res.status_code == 429 and res.json()["detail"]["code"] == "too_many_requests"
