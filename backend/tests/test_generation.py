"""F-002 생성 엔진: 발언 6개, 순서·편, 잠금, 실패→멈춤→재시도, 출력 검사, 발언 목록 API."""

import random
from datetime import timedelta

import pytest

from app.models import Debate, Utterance
from app.providers.base import ProviderError, UtteranceResult
from app.services import generation, moderation
from app.timeutil import utcnow
from tests.factories import make_debate


class FlakyDebater:
    """처음 n번 실패하고 그다음부터 정상 발언."""

    def __init__(self, fail_times: int = 0, text: str = "발언이에요.", caption: str = "자막"):
        self.calls = 0
        self.fail_times = fail_times
        self.text, self.caption = text, caption

    def generate(self, req):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise ProviderError("일부러 실패")
        return UtteranceResult(text=f"{req.round}R {req.side} {self.text}", caption=self.caption)


@pytest.fixture
def use_debater(monkeypatch):
    def _use(debater):
        monkeypatch.setattr(generation, "debater_for", lambda character: debater)
        return debater

    return _use


def _utterances(db, debate_id):
    db.expire_all()
    return list(db.query(Utterance).filter_by(debate_id=debate_id).order_by(Utterance.seq))


def test_plan_alternates_sides_by_round():
    assert [generation.plan(s) for s in range(1, 7)] == [
        (1, "A"), (1, "B"), (2, "A"), (2, "B"), (3, "A"), (3, "B"),
    ]


def test_create_debate_randomizes_cat_side(db):
    sides = {generation.create_debate(db, f"a{i}", f"b{i}", rng=random.Random(i)).cat_side for i in range(10)}
    assert sides == {"A", "B"}


def test_run_until_done_with_mock_makes_six_utterances(db, session_factory):
    debate = generation.create_debate(db, "평생 짜장", "평생 짬뽕")
    generation.run_until_done(debate.id)
    items = _utterances(db, debate.id)
    assert [u.seq for u in items] == [1, 2, 3, 4, 5, 6]
    assert [u.side for u in items] == ["A", "B"] * 3
    assert all(u.caption and len(u.caption) <= moderation.MAX_CAPTION for u in items)
    assert db.get(Debate, debate.id).status == "done"
    assert db.get(Debate, debate.id).lock_until is None


def test_history_is_passed_for_rebuttal(db, use_debater):
    seen = []

    class Recorder(FlakyDebater):
        def generate(self, req):
            seen.append((req.round, req.side, len(req.history)))
            return super().generate(req)

    use_debater(Recorder())
    debate = generation.create_debate(db, "산", "바다")
    generation.run_until_done(debate.id)
    assert seen == [(1, "A", 0), (1, "B", 1), (2, "A", 2), (2, "B", 3), (3, "A", 4), (3, "B", 5)]


def test_lock_blocks_second_worker(db, use_debater):
    use_debater(FlakyDebater())
    debate = generation.create_debate(db, "산", "바다")
    debate.lock_until = utcnow() + timedelta(seconds=60)
    db.commit()
    assert generation.run_next_step(debate.id) == "busy"
    assert _utterances(db, debate.id) == []


def test_expired_lock_is_taken_over(db, use_debater):
    use_debater(FlakyDebater())
    debate = generation.create_debate(db, "산", "바다")
    debate.lock_until = utcnow() - timedelta(seconds=1)
    db.commit()
    assert generation.run_next_step(debate.id) == "generated"


def test_duplicate_seq_is_rejected_by_db(db, use_debater):
    """다른 작업이 같은 순번을 먼저 저장했으면 IntegrityError를 삼키고 그 발언을 쓴다."""
    debate = generation.create_debate(db, "산", "바다")

    class Racer(FlakyDebater):
        def generate(self, req):
            with generation.db_module.SessionLocal() as other:
                other.add(Utterance(debate_id=debate.id, seq=1, round=1, side="A", text="먼저", caption="먼저"))
                other.commit()
            return super().generate(req)

    use_debater(Racer())
    assert generation.run_next_step(debate.id) == "generated"
    assert [u.text for u in _utterances(db, debate.id)] == ["먼저"]


def test_failures_pause_then_retry_resumes(db, use_debater, client):
    flaky = use_debater(FlakyDebater(fail_times=generation.MAX_FAILS))
    debate = generation.create_debate(db, "산", "바다")
    generation.run_until_done(debate.id)
    db.expire_all()
    assert db.get(Debate, debate.id).status == "paused"
    assert flaky.calls == generation.MAX_FAILS

    res = client.post(f"/api/debates/{debate.id}/retry")
    assert res.status_code == 200
    db.expire_all()
    assert db.get(Debate, debate.id).status == "done"  # TestClient는 백그라운드 작업을 응답 뒤 바로 실행
    assert len(_utterances(db, debate.id)) == 6


def test_retry_rejects_when_not_paused(client, db):
    d = make_debate(db)
    res = client.post(f"/api/debates/{d.id}/retry")
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "not_paused"


def test_output_check_retries_once_then_fails(db, use_debater):
    class Dirty(FlakyDebater):
        def generate(self, req):
            self.calls += 1
            return UtteranceResult(text="씨 발 이건 아니죠", caption="자막")

    dirty = use_debater(Dirty())
    debate = generation.create_debate(db, "산", "바다")
    assert generation.run_next_step(debate.id) == "failed"
    assert dirty.calls == 2
    db.expire_all()
    assert db.get(Debate, debate.id).fail_count == 1


def test_check_output_trims_long_text_and_caption():
    long = "가" * 200 + "요. " + "나" * 200
    out = moderation.check_output(UtteranceResult(text=long, caption="“아주아주아주아주아주아주 긴 자막이에요.”"))
    assert len(out.text) <= moderation.MAX_TEXT
    assert len(out.caption) <= moderation.MAX_CAPTION and not out.caption.endswith(".")


def test_utterances_api_after_and_status(client, db):
    d = make_debate(db, status="generating", utterances=3, winner=None)
    body = client.get(f"/api/debates/{d.id}/utterances?after=1").json()
    assert [u["seq"] for u in body["items"]] == [2, 3]
    assert body["status"] == "generating" and body["total"] == 6
    first = body["items"][0]
    assert first["character"] in ("cat", "penguin") and first["empathy_count"] == 0
    assert "winner" not in body


def test_utterances_api_errors(client, db):
    assert client.get("/api/debates/nope/utterances").status_code == 404
    h = make_debate(db, hidden=True)
    res = client.get(f"/api/debates/{h.id}/utterances")
    assert res.status_code == 410 and res.json()["detail"]["code"] == "hidden"
    d = make_debate(db)
    assert client.get(f"/api/debates/{d.id}/utterances?after=-1").status_code == 422


def test_stalled_generation_is_kicked(client, db):
    d = make_debate(db, status="generating", winner=None)
    d.created_at = utcnow() - timedelta(minutes=5)
    db.commit()
    client.get(f"/api/debates/{d.id}/utterances")
    db.expire_all()
    assert db.get(Debate, d.id).status == "done"
    assert len(_utterances(db, d.id)) == 6


def test_seed_creates_debates_once(db, session_factory):
    from app.jobs.seed import SEED_TOPICS, seed

    assert seed() == len(SEED_TOPICS)
    assert seed() == 0  # 이미 있는 주제는 건너뜀
    db.expire_all()
    debates = db.query(Debate).all()
    assert 15 <= len(debates) <= 20
    assert all(d.status == "done" and d.is_seed for d in debates)
