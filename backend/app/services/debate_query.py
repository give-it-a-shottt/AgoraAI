"""토론 조회(목록·오늘의 토론·상세). 승자는 여기서 절대 내보내지 않는다(§5)."""

import math
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.characters import CHARACTERS
from app.models import Debate, Prediction, Utterance
from app.schemas import CastMember, DebateDetail, DebateList, DebateSummary
from app.timeutil import kst_today

Sort = Literal["popular", "latest"]


def cast_of(debate: Debate) -> list[CastMember]:
    members = []
    for side in ("A", "B"):
        key = debate.character_of(side)
        info = CHARACTERS[key]
        members.append(CastMember(character=key, side=side, **info))
    return members


def to_summary(debate: Debate, prediction_count: int) -> DebateSummary:
    return DebateSummary(
        id=debate.id,
        topic_a=debate.topic_a,
        topic_b=debate.topic_b,
        status=debate.status,
        prediction_count=prediction_count,
        created_at=debate.created_at,
        today_date=debate.today_date,
        cast=cast_of(debate),
    )


def _prediction_counts():
    """토론별 예측 수 서브쿼리 — 목록에서 토론마다 따로 세지 않게(N+1 방지)."""
    return (
        select(Prediction.debate_id, func.count(Prediction.id).label("cnt"))
        .group_by(Prediction.debate_id)
        .subquery()
    )


def prediction_count(db: Session, debate_id: str) -> int:
    return db.scalar(select(func.count(Prediction.id)).where(Prediction.debate_id == debate_id)) or 0


def list_debates(db: Session, sort: Sort, page: int, size: int) -> DebateList:
    counts = _prediction_counts()
    cnt = func.coalesce(counts.c.cnt, 0)
    today = kst_today()
    # 지금 홈 맨 위에 걸린 오늘의 토론은 목록에서 빼서 두 번 보이지 않게 한다.
    featured = get_today_debate(db)
    conditions = [Debate.is_hidden.is_(False)]
    if featured is not None and featured.today_date == today:
        conditions.append(Debate.id != featured.id)

    total = db.scalar(select(func.count(Debate.id)).where(*conditions)) or 0
    order = (cnt.desc(), Debate.created_at.desc()) if sort == "popular" else (Debate.created_at.desc(),)
    rows = db.execute(
        select(Debate, cnt)
        .outerjoin(counts, counts.c.debate_id == Debate.id)
        .where(*conditions)
        .order_by(*order, Debate.id)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return DebateList(
        items=[to_summary(d, c) for d, c in rows],
        page=page,
        total_pages=max(1, math.ceil(total / size)),
        total=total,
    )


def get_today_debate(db: Session) -> Debate | None:
    """오늘(한국 날짜) 토론 → 없으면 가장 최근의 오늘의 토론 → 없으면 가장 최근 완료 토론."""
    visible = Debate.is_hidden.is_(False)
    today = kst_today()
    debate = db.scalar(
        select(Debate)
        .where(visible, Debate.today_date.is_not(None), Debate.today_date <= today)
        .order_by(Debate.today_date.desc(), Debate.created_at.desc())
        .limit(1)
    )
    if debate is None:
        debate = db.scalar(
            select(Debate)
            .where(visible, Debate.status == "done")
            .order_by(Debate.created_at.desc())
            .limit(1)
        )
    return debate


def to_detail(db: Session, debate: Debate) -> DebateDetail:
    utterance_count = (
        db.scalar(select(func.count(Utterance.id)).where(Utterance.debate_id == debate.id)) or 0
    )
    summary = to_summary(debate, prediction_count(db, debate.id))
    return DebateDetail(**summary.model_dump(), hidden=debate.is_hidden, utterance_count=utterance_count)
