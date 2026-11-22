"""토론 생성 엔진(D-003): 발언 1개 = 요청 1번. 순번 고유 제약 + 생성 잠금으로 같은 발언을 두 번 만들지 않는다.

흐름: create_debate → (백그라운드) run_until_done → run_next_step × 6 → 완료.
실패가 MAX_FAILS번 이어지면 paused → retry로 다시 generating.
"""

import logging
import random
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import db as db_module
from app.characters import CHARACTERS
from app.models import TOTAL_UTTERANCES, Debate, Utterance
from app.providers import debater_for
from app.providers.base import Debater, Persona, ProviderError, Turn, UtteranceRequest, UtteranceResult
from app.services.moderation import OutputRejected, check_output
from app.services.normalize import normalized_key
from app.timeutil import utcnow

logger = logging.getLogger("agora.generation")

MAX_FAILS = 3  # 연속 실패가 이만큼 쌓이면 멈춤(DEB_01_007)
LOCK_TTL = timedelta(seconds=90)  # 발언 하나 만드는 데 넉넉한 시간. 작업이 죽어도 이후 풀린다
STALL_AFTER = timedelta(seconds=20)  # 이만큼 새 발언이 없고 잠금도 없으면 "멈춘 작업"으로 보고 다시 깨운다

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
    """발언을 만들고 출력 검사. 검사에 걸리면 한 번만 다시 만든다(그래도 걸리면 OutputRejected)."""
    try:
        return check_output(debater.generate(req))
    except OutputRejected:
        logger.info("출력 검사 실패 → 한 번 더 생성")
        return check_output(debater.generate(req))


def _try_lock(db: Session, debate_id: str) -> bool:
    now = utcnow()
    result = db.execute(
        update(Debate)
        .where(
            Debate.id == debate_id,
            Debate.status == "generating",
            or_(Debate.lock_until.is_(None), Debate.lock_until < now),
        )
        .values(lock_until=now + LOCK_TTL)
    )
    db.commit()
    return result.rowcount == 1


def _release_lock(db: Session, debate_id: str) -> None:
    db.execute(update(Debate).where(Debate.id == debate_id).values(lock_until=None))
    db.commit()


def _record_failure(db: Session, debate_id: str) -> None:
    debate = db.get(Debate, debate_id)
    if debate is None:
        return
    debate.fail_count += 1
    if debate.fail_count >= MAX_FAILS:
        debate.status = "paused"
        logger.warning("토론 %s 생성 멈춤(실패 %s번)", debate_id, debate.fail_count)
    db.commit()


def _finish(db: Session, debate: Debate) -> None:
    debate.status = "done"
    debate.fail_count = 0
    db.commit()


def run_next_step(debate_id: str) -> StepOutcome:
    """다음 발언 하나를 만든다. 다른 작업이 잡고 있으면 busy, 생성 중이 아니면 stopped."""
    with db_module.SessionLocal() as s:
        if not _try_lock(s, debate_id):
            debate = s.get(Debate, debate_id)
            return "busy" if debate is not None and debate.status == "generating" else "stopped"
        try:
            debate = s.get(Debate, debate_id)
            history = list(s.scalars(select(Utterance).where(Utterance.debate_id == debate_id).order_by(Utterance.seq)))
            if len(history) >= TOTAL_UTTERANCES:
                _finish(s, debate)
                return "finished"
            seq = len(history) + 1
            round_, side = plan(seq)
            result = generate_checked(debater_for(debate.character_of(side)), build_request(debate, seq, history))
            s.add(Utterance(debate_id=debate_id, seq=seq, round=round_, side=side, text=result.text, caption=result.caption))
            debate.fail_count = 0
            s.commit()
            if seq == TOTAL_UTTERANCES:
                _finish(s, debate)
                return "finished"
            return "generated"
        except IntegrityError:
            # 같은 순번을 누가 먼저 저장했다(잠금이 풀린 뒤 겹친 경우) → 그 발언을 쓰면 된다.
            s.rollback()
            return "generated"
        except (ProviderError, OutputRejected) as exc:
            s.rollback()
            logger.warning("토론 %s 발언 생성 실패: %s", debate_id, exc)
            _record_failure(s, debate_id)
            return "failed"
        finally:
            _release_lock(s, debate_id)


def run_until_done(debate_id: str) -> None:
    """백그라운드 작업: 끝나거나 멈추거나 다른 작업이 잡을 때까지 발언을 이어서 만든다."""
    for _ in range(TOTAL_UTTERANCES + MAX_FAILS + 1):
        outcome = run_next_step(debate_id)
        if outcome in ("finished", "busy", "stopped"):
            return
        if outcome == "failed":
            with db_module.SessionLocal() as s:
                debate = s.get(Debate, debate_id)
                if debate is None or debate.status != "generating":
                    return


class NotPaused(Exception):
    pass


def retry(db: Session, debate: Debate) -> None:
    """멈춘 토론을 다시 생성 중으로(DEB_01_007 [다시 시도]). 이어서 만들기는 호출한 쪽이 백그라운드로 건다."""
    if debate.status != "paused":
        raise NotPaused
    debate.status = "generating"
    debate.fail_count = 0
    debate.lock_until = None
    db.commit()


def needs_kick(db: Session, debate: Debate) -> bool:
    """생성 중인데 잠금도 없고 한동안 새 발언이 없으면 작업이 죽은 것 → 다시 깨운다(서버리스에서 작업이 끊길 때 대비, Q-005)."""
    if debate.status != "generating":
        return False
    now = utcnow()
    if debate.lock_until is not None and debate.lock_until > now:
        return False
    last = db.scalar(
        select(Utterance.created_at).where(Utterance.debate_id == debate.id).order_by(Utterance.seq.desc()).limit(1)
    )
    return now - (last or debate.created_at) > STALL_AFTER
