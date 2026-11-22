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
    assert res.status_code == 200 and res.json()["judge_status"] == "pending"  # 바로 대기로, 판정은 백그라운드
    assert client.get(f"/api/debates/{d.id}/result").json()["winner"] == "B"
    again = client.post(f"/api/debates/{d.id}/judge/retry")
    assert again.status_code == 409 and again.json()["detail"]["code"] == "not_failed"


def test_judge_retry_limit(client, db, use_judge):
    use_judge(FixedJudge(fail=True))
    d = _finished(db)
    d.judge_status, d.judge_attempts = "failed", judging.MAX_JUDGE_ATTEMPTS
    db.commit()
    res = client.post(f"/api/debates/{d.id}/judge/retry")
    assert res.status_code == 409 and res.json()["detail"]["code"] == "judge_limit"


def test_reports_hide_after_three(client, db, monkeypatch):
    from app import deps

    # 서로 다른 세 사람(접속자)처럼: 브라우저 번호를 접속자 키로 쓴다
    client.app.dependency_overrides[deps.client_key] = lambda x_browser_id=None: "x"
    from fastapi import Header

    def per_browser(x_browser_id: str | None = Header(None)) -> str:
        return f"client-{x_browser_id}"

    client.app.dependency_overrides[deps.client_key] = per_browser
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


def test_one_person_cannot_hide_alone(client, db):
    """브라우저 번호를 바꿔도 같은 접속자(IP 해시)면 1명으로 센다(Q-013)."""
    d = make_debate(db)
    for i in range(3):
        b = f"6666666{i}-6666-4666-8666-666666666666"
        assert client.post(f"/api/debates/{d.id}/reports", json={"reason": "hate"}, headers={"X-Browser-Id": b}).json()["hidden"] is False


def test_stuck_pending_becomes_failed(client, db):
    d = _finished(db)
    d.judge_status, d.judge_attempts = "pending", judging.MAX_JUDGE_ATTEMPTS
    db.commit()
    assert client.get(f"/api/debates/{d.id}/result").json()["judge_status"] == "failed"


def test_judge_lock_contention_and_stale_lock(db, use_judge):
    from datetime import timedelta

    from app.timeutil import utcnow

    judge = use_judge(FixedJudge())
    d = _finished(db)
    d.lock_until = utcnow() + timedelta(seconds=60)  # 다른 작업이 판정 중
    db.commit()
    assert judging.judge_debate(d.id) == "pending" and judge.calls == 0
    d = db.get(Debate, d.id)
    d.lock_until = utcnow() - timedelta(seconds=1)  # 그 작업이 죽고 잠금 만료
    db.commit()
    db.expire_all()
    assert judging.needs_judging(db.get(Debate, d.id))
    assert judging.judge_debate(d.id) == "done"


def test_short_stances_keep_fixed_denominator(db, use_judge):
    class Short(FixedJudge):
        def judge(self, a, b, turns):
            return JudgeResult(winner="A", reason="r", stances=["rebut", "rebut"])

    use_judge(Short())
    d = _finished(db)
    judging.judge_debate(d.id)
    db.expire_all()
    assert db.get(Debate, d.id).rebut_rate == pytest.approx(2 / 5)


def test_judge_needs_six_utterances(db, use_judge):
    use_judge(FixedJudge())
    d = make_debate(db, utterances=4, winner=None)
    assert judging.judge_debate(d.id) == "failed"


def test_retry_and_report_errors(client, db):
    assert client.post("/api/debates/nope/judge/retry").status_code == 404
    assert client.post("/api/debates/nope/reports", json={"reason": "hate"}).status_code == 404
    h = make_debate(db, hidden=True, utterances=6)
    assert client.post(f"/api/debates/{h.id}/judge/retry").status_code == 410
    assert client.post(f"/api/debates/{h.id}/reports", json={"reason": "hate"}).status_code == 410
    d = _finished(db)
    assert client.post(f"/api/debates/{d.id}/judge/retry", headers={"X-Browser-Id": "x"}).status_code == 400


def test_unhide_job(db):
    from app.jobs.unhide import unhide
    from app.models import Report

    d = make_debate(db, hidden=True)
    db.add(Report(debate_id=d.id, browser_id="b", reason="hate", client_hash="c"))
    db.commit()
    assert unhide(d.id, clear_reports=True)
    db.expire_all()
    assert db.get(Debate, d.id).is_hidden is False
    assert db.query(Report).filter_by(debate_id=d.id).count() == 0
    assert unhide("nope") is False
