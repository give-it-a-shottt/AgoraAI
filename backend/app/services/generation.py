"""토론 생성 엔진(D-003): 발언 1개 = 요청 1번. 순번 고유 제약 + 생성 잠금으로 같은 발언을 두 번 만들지 않는다.

흐름: create_debate → (백그라운드) run_until_done → run_next_step × 6 → 완료.
실패가 MAX_FAILS번 이어지면 paused → retry로 다시 generating.
"""

import logging
import random
import threading
import time
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import case, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import db as db_module
from app.characters import CHARACTERS
from app.models import TOTAL_UTTERANCES, Debate, Utterance
from app.providers import debater_for
from app.providers.base import (
    Debater,
    Persona,
    ProviderError,
    Turn,
    UtteranceRequest,
    UtteranceResult,
)
from app.services.moderation import OutputRejected, check_output
from app.services.normalize import normalized_key
from app.timeutil import utcnow

logger = logging.getLogger("agora.generation")

MAX_FAILS = 3  # 연속 실패가 이만큼 쌓이면 멈춤(DEB_01_007)
# 발언 하나의 최악 소요: 공급자 호출 40초(읽기 제한) × 출력 검사 재생성 2번 + 여유. 작업이 죽어도 이 뒤엔 풀린다.
LOCK_TTL = timedelta(seconds=180)
STALL_AFTER = timedelta(seconds=20)  # 생성 중인데 잠금도 새 발언도 없으면 "죽은 작업"으로 보고 다시 깨운다
FAIL_BACKOFF_SECONDS = (2.0, 4.0)  # 연속 실패 사이 대기(429 같은 일시 장애가 몇 초 만에 paused가 되지 않게)
# 재시도 남용 방지: 로그인 없이 누구나 누를 수 있어서, 토론당 횟수와 멈춘 뒤 대기 시간을 둔다(유료·무료 한도 보호).
MAX_RETRIES = 3
RETRY_COOLDOWN = timedelta(seconds=60)
# 동시에 도는 생성 작업 수 상한: API 요청과 같은 스레드풀을 쓰므로 너무 많이 잡지 않게. 넘치면 나중에 needs_kick이 다시 깨운다.
MAX_CONCURRENT_GENERATIONS = 4
_generation_slots = threading.BoundedSemaphore(MAX_CONCURRENT_GENERATIONS)

StepOutcome = Literal["generated", "finished", "busy", "stopped", "failed"]


def plan(seq: int) -> tuple[int, str]:
    """순번 → (라운드, 편). 라운드마다 A 편 → B 편."""
    return (seq + 1) // 2, ("A" if seq % 2 == 1 else "B")


def create_debate(
    db: Session,
    topic_a: str,
    topic_b: str,
    *,
    creator_id: int | None = None,
    today_date: date | None = None,
    is_seed: bool = False,
    rng: random.Random | None = None,
) -> Debate:
    """토론 행을 만든다. 냥냥이가 맡을 편은 토론마다 무작위(§0-1)."""
    debate = Debate(
        topic_a=topic_a.strip(),
        topic_b=topic_b.strip(),
        normalized_key=normalized_key(topic_a, topic_b),
        cat_side=(rng or random).choice(["A", "B"]),
        status="generating",
        creator_id=creator_id,
        today_date=today_date,
        is_seed=is_seed,
    )
    db.add(debate)
    db.commit()
    return debate


def _persona(character: str) -> Persona:
    info = CHARACTERS[character]
    return Persona(name=info["name"], catchphrase=info["catchphrase"])


def build_request(debate: Debate, seq: int, history: list[Utterance]) -> UtteranceRequest:
    round_, side = plan(seq)
    me = debate.character_of(side)
    other = debate.character_of("B" if side == "A" else "A")
    turns = [Turn(side=u.side, speaker=CHARACTERS[debate.character_of(u.side)]["name"], text=u.text) for u in history]
    return UtteranceRequest(
        topic_a=debate.topic_a,
        topic_b=debate.topic_b,
        side=side,
        round=round_,
        persona=_persona(me),
        opponent=_persona(other),
        history=turns,
    )


def generate_checked(debater: Debater, req: UtteranceRequest) -> UtteranceResult:
    """발언을 만들고 출력 검사. 검사에 걸리면 한 번만 다시 만든다(그래도 걸리면 OutputRejected).
    공급자 오류(ProviderError)는 여기서 다시 부르지 않고 실패 1번으로 센다(실패 사이 대기는 run_until_done)."""
    try:
        return check_output(debater.generate(req))
    except OutputRejected:
        logger.info("출력 검사 실패 → 한 번 더 생성")
        return check_output(debater.generate(req))


def _try_lock(db: Session, debate_id: str) -> datetime | None:
    """잠금을 잡으면 이번 작업의 잠금 값(만료 시각)을, 못 잡으면 None.
    만료된 잠금이 남아 있었다면 이전 작업이 정리도 못 하고 죽은 것 → 실패 1번으로 같이 센다
    (안 세면 같은 지점에서 계속 죽을 때 재기동만 끝없이 반복된다)."""
    now = utcnow()
    token = now + LOCK_TTL
    result = db.execute(
        update(Debate)
        .where(
            Debate.id == debate_id,
            Debate.status == "generating",
            or_(Debate.lock_until.is_(None), Debate.lock_until < now),
        )
        .values(
            lock_until=token,
            fail_count=case((Debate.lock_until.is_not(None), Debate.fail_count + 1), else_=Debate.fail_count),
        )
    )
    db.commit()
    return token if result.rowcount == 1 else None


def _release_lock(db: Session, debate_id: str, token: datetime) -> None:
    """내가 건 잠금일 때만 푼다(만료 뒤 다른 작업이 새로 건 잠금을 지우지 않게)."""
    db.execute(update(Debate).where(Debate.id == debate_id, Debate.lock_until == token).values(lock_until=None))
    db.commit()


def _record_failure(db: Session, debate_id: str) -> None:
    debate = db.get(Debate, debate_id)
    if debate is None:
        return
    debate.fail_count += 1
    if debate.fail_count >= MAX_FAILS:
        debate.status = "paused"
        debate.paused_at = utcnow()
        logger.warning("토론 %s 생성 멈춤(실패 %s번)", debate_id, debate.fail_count)
    db.commit()


def _finish(db: Session, debate: Debate) -> None:
    debate.status = "done"
    debate.fail_count = 0
    db.commit()


def _seq_exists(db: Session, debate_id: str, seq: int) -> bool:
    return db.scalar(select(Utterance.id).where(Utterance.debate_id == debate_id, Utterance.seq == seq)) is not None


def _generate_one(s: Session, debate: Debate) -> StepOutcome:
    """이력을 읽고 다음 순번 발언 하나를 만들어 저장한다. 6개가 차면 완료."""
    history = list(s.scalars(select(Utterance).where(Utterance.debate_id == debate.id).order_by(Utterance.seq)))
    seq = len(history) + 1
    if seq <= TOTAL_UTTERANCES:
        round_, side = plan(seq)
        result = generate_checked(debater_for(debate.character_of(side)), build_request(debate, seq, history))
        s.add(Utterance(debate_id=debate.id, seq=seq, round=round_, side=side, text=result.text, caption=result.caption))
        debate.fail_count = 0
        try:
            s.commit()
        except IntegrityError:
            s.rollback()
            if not _seq_exists(s, debate.id, seq):
                raise  # 순번 충돌이 아닌 다른 제약 위반 → 실패로 센다
            # 같은 순번을 다른 작업이 먼저 저장했다(잠금 만료 뒤 겹친 경우) → 그 발언을 쓰면 된다.
            return "generated"
        if seq < TOTAL_UTTERANCES:
            return "generated"
    _finish(s, debate)
    return "finished"


def run_next_step(debate_id: str) -> StepOutcome:
    """다음 발언 하나를 만든다. 다른 작업이 잡고 있으면 busy, 생성 중이 아니면 stopped."""
    with db_module.SessionLocal() as s:
        token = _try_lock(s, debate_id)
        if token is None:
            debate = s.get(Debate, debate_id)
            return "busy" if debate is not None and debate.status == "generating" else "stopped"
        try:
            debate = s.get(Debate, debate_id)
            if debate.fail_count >= MAX_FAILS:
                # 죽은 작업이 쌓여 실패 한도에 닿았다(_try_lock이 셈) → AI를 부르지 않고 멈춘다.
                _record_failure(s, debate_id)
                return "stopped"
            return _generate_one(s, debate)
        except (ProviderError, OutputRejected) as exc:
            s.rollback()
            logger.warning("토론 %s 발언 생성 실패: %s", debate_id, exc)
            _record_failure(s, debate_id)
            return "failed"
        except Exception:
            # 예상 못 한 오류도 실패로 센다 — 안 세면 paused가 되지 않아 재기동만 반복된다.
            s.rollback()
            logger.exception("토론 %s 발언 생성 중 예상 못 한 오류", debate_id)
            _record_failure(s, debate_id)
            return "failed"
        finally:
            _release_lock(s, debate_id, token)


def _still_generating(debate_id: str) -> bool:
    with db_module.SessionLocal() as s:
        debate = s.get(Debate, debate_id)
        return debate is not None and debate.status == "generating"


def run_until_done(debate_id: str) -> None:
    """백그라운드 작업: 끝나거나 멈추거나 다른 작업이 잡을 때까지 발언을 이어서 만든다."""
    if not _generation_slots.acquire(blocking=False):
        logger.info("동시 생성 상한 → 토론 %s는 다음 재기동 때 이어서", debate_id)
        return
    try:
        _run_steps(debate_id)
    finally:
        _generation_slots.release()


def _run_steps(debate_id: str) -> None:
    fails_in_row = 0
    for _ in range(TOTAL_UTTERANCES + MAX_FAILS + 1):
        outcome = run_next_step(debate_id)
        if outcome in ("finished", "busy", "stopped"):
            return
        if outcome == "failed":
            if not _still_generating(debate_id):
                return
            time.sleep(FAIL_BACKOFF_SECONDS[min(fails_in_row, len(FAIL_BACKOFF_SECONDS) - 1)])
            fails_in_row += 1
        else:
            fails_in_row = 0


class NotPaused(Exception):
    pass


class RetryTooSoon(Exception):
    def __init__(self, seconds_left: int):
        self.seconds_left = seconds_left


class RetryLimitReached(Exception):
    pass


def retry(db: Session, debate: Debate) -> None:
    """멈춘 토론을 다시 생성 중으로(DEB_01_007 [다시 시도]).
    잠금 확인: paused 토론은 작업이 돌지 않으므로 잠금을 비우고 시작한다.
    한도 확인: 토론당 MAX_RETRIES번, 멈춘 뒤 RETRY_COOLDOWN 대기. 서비스 전체 하루 한도는 F-007에서 붙인다(Q-002).
    이어서 만들기는 호출한 쪽이 백그라운드로 건다.
    확인과 변경을 조건부 UPDATE 한 번으로 해서, 동시에 여러 번 눌러도 한 번만 통과한다."""
    now = utcnow()
    result = db.execute(
        update(Debate)
        .where(
            Debate.id == debate.id,
            Debate.status == "paused",
            Debate.retry_count < MAX_RETRIES,
            or_(Debate.paused_at.is_(None), Debate.paused_at <= now - RETRY_COOLDOWN),
        )
        .values(retry_count=Debate.retry_count + 1, status="generating", fail_count=0, lock_until=None)
    )
    db.commit()
    db.refresh(debate)
    if result.rowcount == 1:
        return
    # 통과하지 못한 이유를 가린다.
    if debate.status != "paused":
        raise NotPaused
    if debate.retry_count >= MAX_RETRIES:
        raise RetryLimitReached
    left = (debate.paused_at + RETRY_COOLDOWN) - now if debate.paused_at else RETRY_COOLDOWN
    raise RetryTooSoon(max(1, int(left.total_seconds()) + 1))


def needs_kick(db: Session, debate: Debate) -> bool:
    """생성 중인데 잠금도 없고 한동안 새 발언이 없으면 작업이 죽은 것 → 다시 깨운다(서버리스에서 작업이 끊길 때 대비, Q-005).
    paused는 깨우지 않는다(사용자가 [다시 시도]를 눌러야 재개)."""
    if debate.status != "generating":
        return False
    now = utcnow()
    if debate.lock_until is not None and debate.lock_until > now:
        return False
    last = db.scalar(
        select(Utterance.created_at).where(Utterance.debate_id == debate.id).order_by(Utterance.seq.desc()).limit(1)
    )
    return now - (last or debate.created_at) > STALL_AFTER
