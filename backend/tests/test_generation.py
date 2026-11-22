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

    _pause(db, db.get(Debate, debate.id))  # 재시도 대기 시간(RETRY_COOLDOWN)이 지난 상태로
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

    assert seed() == {"created": len(SEED_TOPICS), "done": len(SEED_TOPICS), "unfinished": 0}
    assert seed()["created"] == 0  # 이미 있는 주제는 건너뜀
    db.expire_all()
    debates = db.query(Debate).all()
    assert 15 <= len(debates) <= 20
    assert all(d.status == "done" and d.is_seed for d in debates)


def _pause(db, debate, *, minutes_ago=5, retries=0):
    debate.status = "paused"
    debate.paused_at = utcnow() - timedelta(minutes=minutes_ago)
    debate.retry_count = retries
    db.commit()


def test_retry_cooldown_and_limit(client, db, use_debater):
    use_debater(FlakyDebater())
    d = generation.create_debate(db, "산", "바다")
    _pause(db, d, minutes_ago=0)
    res = client.post(f"/api/debates/{d.id}/retry")
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "retry_too_soon" and res.json()["detail"]["retry_after"] > 0
    _pause(db, d, retries=generation.MAX_RETRIES)
    res = client.post(f"/api/debates/{d.id}/retry")
    assert res.status_code == 409 and res.json()["detail"]["code"] == "retry_limit"
    _pause(db, d, retries=0)
    assert client.post(f"/api/debates/{d.id}/retry").status_code == 200
    db.expire_all()
    assert db.get(Debate, d.id).retry_count == 1


def test_retry_missing_and_hidden(client, db):
    assert client.post("/api/debates/nope/retry").status_code == 404
    h = make_debate(db, hidden=True)
    assert client.post(f"/api/debates/{h.id}/retry").status_code == 410


def test_after_bounds(client, db):
    d = make_debate(db, utterances=6)
    assert client.get(f"/api/debates/{d.id}/utterances?after=6").json()["items"] == []
    assert client.get(f"/api/debates/{d.id}/utterances?after=7").status_code == 422


def test_unexpected_error_counts_as_failure(db, use_debater):
    class Broken(FlakyDebater):
        def generate(self, req):
            raise KeyError("버그")

    use_debater(Broken())
    d = generation.create_debate(db, "산", "바다")
    generation.run_until_done(d.id)
    db.expire_all()
    debate = db.get(Debate, d.id)
    assert debate.status == "paused" and debate.paused_at is not None
    assert debate.lock_until is None


def test_provider_error_is_not_regenerated_in_same_step(db, use_debater):
    flaky = use_debater(FlakyDebater(fail_times=1))
    d = generation.create_debate(db, "산", "바다")
    assert generation.run_next_step(d.id) == "failed"
    assert flaky.calls == 1


def test_release_lock_keeps_someone_elses_lock(db):
    d = generation.create_debate(db, "산", "바다")
    mine = generation._try_lock(db, d.id)
    other = utcnow() + timedelta(seconds=999)
    d.lock_until = other  # 내 잠금이 만료된 뒤 다른 작업이 새로 잡은 상황
    db.commit()
    generation._release_lock(db, d.id, mine)
    db.expire_all()
    assert db.get(Debate, d.id).lock_until == other


def test_concurrency_cap_skips_extra_workers(db, use_debater, monkeypatch):
    import threading

    use_debater(FlakyDebater())
    monkeypatch.setattr(generation, "_generation_slots", threading.BoundedSemaphore(1))
    generation._generation_slots.acquire()  # 자리를 다른 작업이 쓰고 있는 상황
    d = generation.create_debate(db, "산", "바다")
    generation.run_until_done(d.id)
    assert _utterances(db, d.id) == []  # 자리가 없으면 다음 재기동 때로 미룸


@pytest.mark.parametrize("text", ["살인적인 더위예요", "모든 일의 시발점이죠", "그 한 녀석이 문제", "마약김밥 최고"])
def test_common_phrases_are_not_banned(text):
    assert not moderation.contains_banned(text)


def test_banned_words_still_caught():
    assert moderation.contains_banned("이 병 신 같은")


def test_dead_worker_locks_count_as_failures(db, use_debater):
    """작업이 정리 없이 죽어 만료된 잠금만 남으면, 다음 작업이 실패로 센다 → 3번이면 AI 호출 없이 멈춤."""
    debater = use_debater(FlakyDebater())
    d = generation.create_debate(db, "산", "바다")
    for _ in range(generation.MAX_FAILS - 1):
        d.lock_until = utcnow() - timedelta(seconds=1)  # 죽은 작업이 남긴 잠금
        db.commit()
        token = generation._try_lock(db, d.id)
        assert token is not None
        generation._release_lock(db, d.id, token)
        db.expire_all()
    assert db.get(Debate, d.id).fail_count == generation.MAX_FAILS - 1
    d = db.get(Debate, d.id)
    d.lock_until = utcnow() - timedelta(seconds=1)
    db.commit()
    assert generation.run_next_step(d.id) == "stopped"
    db.expire_all()
    assert db.get(Debate, d.id).status == "paused"
    assert debater.calls == 0


def test_retry_is_atomic_under_double_click(db, session_factory):
    """같은 토론을 두 요청이 동시에 읽고 재시도해도 한 번만 통과한다."""
    d = generation.create_debate(db, "산", "바다")
    _pause(db, d)
    first, second = session_factory(), session_factory()
    try:
        a = first.get(Debate, d.id)
        b = second.get(Debate, d.id)  # 둘 다 paused 상태를 읽음
        generation.retry(first, a)
        with pytest.raises(generation.NotPaused):
            generation.retry(second, b)
    finally:
        first.close()
        second.close()
    db.expire_all()
    assert db.get(Debate, d.id).retry_count == 1


def test_long_caption_is_cut_at_a_space_with_ellipsis():
    """자막이 길면 글자 중간이 아니라 띄어쓰기에서 자르고 "…"를 붙인다(예: "확률로 "로 끝나던 문제)."""
    out = moderation.check_output(UtteranceResult(text="발언", caption="국물 없는 짜장은 70퍼센트 확률로 금방 물려요"))
    assert out.caption == "국물 없는 짜장은 70퍼센트…"
    assert len(out.caption) <= moderation.MAX_CAPTION
    short = moderation.check_output(UtteranceResult(text="발언", caption="비 오는 날엔 짜장"))
    assert short.caption == "비 오는 날엔 짜장"  # 짧으면 그대로
