"""심판 판정과 품질 지표(F-005). 6발언이 다 모이면 심판 AI(Groq)가 승자·이유·발언별 태도를 정한다.

지표(§0-2 P5, DEB_01_005):
- 반박률(제대로 맞붙은 발언) = 2번째 발언부터 '직전 상대 발언을 집어 반박'한 비율
- 동의율(서로 맞장구친 발언) = 같은 범위에서 '반박 없이 동의·맞장구'한 비율
"""

import logging
from datetime import timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app import db as db_module
from app.characters import CHARACTERS
from app.models import TOTAL_UTTERANCES, Debate, Utterance
from app.providers import judge as judge_provider
from app.providers.base import Turn
from app.timeutil import utcnow

logger = logging.getLogger("agora.judging")

JUDGE_LOCK_TTL = timedelta(seconds=90)
MAX_JUDGE_ATTEMPTS = 4  # 처음 1번 + 다시 시도 3번(공개 버튼이라 상한을 둔다)


def compute_rates(stances: list[str]) -> tuple[float, float]:
    if not stances:
        return 0.0, 0.0
    n = len(stances)
    return stances.count("rebut") / n, stances.count("agree") / n


def _try_lock(db: Session, debate_id: str) -> bool:
    """판정 중복 방지: 완료된 토론은 생성 잠금(lock_until)을 판정 잠금으로 다시 쓴다."""
    now = utcnow()
    result = db.execute(
        update(Debate)
        .where(
            Debate.id == debate_id,
            Debate.status == "done",
            Debate.judge_status != "done",
            Debate.judge_attempts < MAX_JUDGE_ATTEMPTS,
            or_(Debate.lock_until.is_(None), Debate.lock_until < now),
        )
        .values(lock_until=now + JUDGE_LOCK_TTL, judge_attempts=Debate.judge_attempts + 1, judge_status="pending")
    )
    db.commit()
    return result.rowcount == 1


def judge_debate(debate_id: str) -> str:
    """판정을 한 번 시도한다. 결과 judge_status(done/failed/pending=다른 작업이 진행 중·상한)를 돌려준다."""
    with db_module.SessionLocal() as s:
        if not _try_lock(s, debate_id):
            debate = s.get(Debate, debate_id)
            return debate.judge_status if debate else "failed"
        debate = s.get(Debate, debate_id)
        try:
            items = list(s.scalars(select(Utterance).where(Utterance.debate_id == debate_id).order_by(Utterance.seq)))
            if len(items) < TOTAL_UTTERANCES:
                raise ValueError("발언이 다 모이지 않음")
            turns = [Turn(side=u.side, speaker=CHARACTERS[debate.character_of(u.side)]["name"], text=u.text) for u in items]
            result = judge_provider().judge(debate.topic_a, debate.topic_b, turns)
            # 분모를 "2번째 발언부터 5개"로 고정한다(심판이 덜 주면 neutral로 채우고, 더 주면 자른다).
            expected = TOTAL_UTTERANCES - 1
            stances = (list(result.stances) + ["neutral"] * expected)[:expected]
            for utterance, stance in zip(items[1:], stances, strict=True):
                utterance.stance_label = stance
            debate.winner = result.winner
            debate.judge_reason = result.reason
            debate.rebut_rate, debate.agree_rate = compute_rates(stances)
            debate.judge_status = "done"
        except Exception:
            s.rollback()
            logger.exception("토론 %s 판정 실패", debate_id)
            debate = s.get(Debate, debate_id)
            debate.judge_status = "failed"
        debate.lock_until = None
        s.commit()
        return debate.judge_status


def queue_retry(db: Session, debate: Debate) -> bool:
    """실패한 판정을 다시 대기(pending)로 돌린다. 실제 판정은 백그라운드에서(요청이 AI를 기다리며 연결을 잡지 않게)."""
    result = db.execute(
        update(Debate)
        .where(
            Debate.id == debate.id,
            Debate.judge_status == "failed",
            Debate.judge_attempts < MAX_JUDGE_ATTEMPTS,
        )
        .values(judge_status="pending", lock_until=None)
    )
    db.commit()
    db.refresh(debate)
    return result.rowcount == 1


def settle_stuck(db: Session, debate: Debate) -> None:
    """마지막 시도 중 작업이 죽어 pending으로 굳은 판정은 실패로 확정한다(안 그러면 "판정 준비 중"이 끝없이)."""
    lock_expired = debate.lock_until is None or debate.lock_until < utcnow()
    if (
        debate.status == "done"
        and debate.judge_status == "pending"
        and debate.judge_attempts >= MAX_JUDGE_ATTEMPTS
        and lock_expired
    ):
        debate.judge_status = "failed"
        db.commit()


def needs_judging(debate: Debate) -> bool:
    """완료됐는데 판정이 아직이고(작업이 끊겼을 수 있음) 잠금도 없으면 다시 판정을 건다."""
    if debate.status != "done" or debate.judge_status != "pending":
        return False
    if debate.judge_attempts >= MAX_JUDGE_ATTEMPTS:
        return False
    return debate.lock_until is None or debate.lock_until < utcnow()
