"""토론 조회(목록·오늘의 토론·상세). 승자는 여기서 절대 내보내지 않는다(§5)."""

import math
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import providers
from app.characters import CHARACTERS
from app.models import TOTAL_UTTERANCES, Debate, Empathy, Prediction, Utterance
from app.schemas import (
    CastMember,
    DebateDetail,
    DebateList,
    DebateSummary,
    UtteranceList,
    UtteranceOut,
)
from app.timeutil import kst_today

Sort = Literal["popular", "latest"]
_VISIBLE = Debate.is_hidden.is_(False)


def cast_of(debate: Debate) -> list[CastMember]:
    members = []
    for side in ("A", "B"):
        key = debate.character_of(side)
        info = {**CHARACTERS[key], "ai": providers.ai_label(key, CHARACTERS[key]["ai"])}  # 실제 쓰는 AI 이름(D-005)
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


def prediction_count(db: Session, debate_id: str) -> int:
    return db.scalar(select(func.count(Prediction.id)).where(Prediction.debate_id == debate_id)) or 0


def _counts_for(db: Session, ids: list[str]) -> dict[str, int]:
    """보여 줄 토론들의 예측 수만 한 번에 센다(토론마다 따로 세지 않게 — N+1 방지)."""
    if not ids:
        return {}
    rows = db.execute(
        select(Prediction.debate_id, func.count(Prediction.id))
        .where(Prediction.debate_id.in_(ids))
        .group_by(Prediction.debate_id)
    ).all()
    return dict(rows)


def get_today_debate(db: Session) -> Debate | None:
    """홈 맨 위에 걸 토론(Q-010 임시 규칙):
    오늘(한국 날짜)까지의 가장 최근 오늘의 토론 → 가장 최근 완료 토론 → 가장 최근 토론(진행 중 포함)."""
    candidates = (
        select(Debate)
        .where(_VISIBLE, Debate.today_date.is_not(None), Debate.today_date <= kst_today())
        .order_by(Debate.today_date.desc(), Debate.created_at.desc()),
        select(Debate).where(_VISIBLE, Debate.status == "done").order_by(Debate.created_at.desc()),
        select(Debate).where(_VISIBLE).order_by(Debate.created_at.desc()),
    )
    for query in candidates:
        debate = db.scalar(query.limit(1))
        if debate is not None:
            return debate
    return None


def get_today_summary(db: Session) -> DebateSummary | None:
    debate = get_today_debate(db)
    return None if debate is None else to_summary(debate, prediction_count(db, debate.id))


def list_debates(db: Session, sort: Sort, page: int, size: int) -> DebateList:
    """홈 목록. 맨 위 카드에 걸린 토론은 빼서 두 번 보이지 않게 한다(Q-010)."""
    conditions = [_VISIBLE]
    featured = get_today_debate(db)
    if featured is not None:
        conditions.append(Debate.id != featured.id)

    total = db.scalar(select(func.count(Debate.id)).where(*conditions)) or 0
    offset = (page - 1) * size
    if sort == "popular":
        # 인기순은 예측 수로 정렬해야 해서 집계 서브쿼리를 조인한다.
        counts = (
            select(Prediction.debate_id, func.count(Prediction.id).label("cnt"))
            .group_by(Prediction.debate_id)
            .subquery()
        )
        cnt = func.coalesce(counts.c.cnt, 0)
        rows = db.execute(
            select(Debate, cnt)
            .outerjoin(counts, counts.c.debate_id == Debate.id)
            .where(*conditions)
            .order_by(cnt.desc(), Debate.created_at.desc(), Debate.id)
            .offset(offset)
            .limit(size)
        ).all()
        items = [to_summary(d, c) for d, c in rows]
    else:
        # 최신순은 한 페이지를 먼저 뽑고 그 토론들의 예측 수만 센다.
        debates = db.scalars(
            select(Debate)
            .where(*conditions)
            .order_by(Debate.created_at.desc(), Debate.id)
            .offset(offset)
            .limit(size)
        ).all()
        counts_by_id = _counts_for(db, [d.id for d in debates])
        items = [to_summary(d, counts_by_id.get(d.id, 0)) for d in debates]

    return DebateList(items=items, page=page, total_pages=max(1, math.ceil(total / size)), total=total)


def get_detail(db: Session, debate_id: str) -> DebateDetail | None:
    """상세. 가려진 토론(DEB_01_008)은 주제만 알려 주고 개수는 세지 않는다."""
    debate = db.get(Debate, debate_id)
    if debate is None:
        return None
    if debate.is_hidden:
        return DebateDetail(**to_summary(debate, 0).model_dump(), hidden=True, utterance_count=0)
    utterance_count = (
        db.scalar(select(func.count(Utterance.id)).where(Utterance.debate_id == debate.id)) or 0
    )
    summary = to_summary(debate, prediction_count(db, debate.id))
    return DebateDetail(**summary.model_dump(), hidden=False, utterance_count=utterance_count)


def list_utterances(db: Session, debate: Debate, after: int) -> UtteranceList:
    """무대가 읽는 발언 목록(after보다 큰 순번만). 공감 수는 발언별로 한 번에 센다."""
    # 이 토론 발언의 공감만 센다(공감 테이블 전체를 집계하지 않게).
    this_debate = select(Utterance.id).where(Utterance.debate_id == debate.id)
    empathy = (
        select(Empathy.utterance_id, func.count(Empathy.id).label("cnt"))
        .where(Empathy.utterance_id.in_(this_debate))
        .group_by(Empathy.utterance_id)
        .subquery()
    )
    rows = db.execute(
        select(Utterance, func.coalesce(empathy.c.cnt, 0))
        .outerjoin(empathy, empathy.c.utterance_id == Utterance.id)
        .where(Utterance.debate_id == debate.id, Utterance.seq > after)
        .order_by(Utterance.seq)
    ).all()
    items = [
        UtteranceOut(
            id=u.id,
            seq=u.seq,
            round=u.round,
            side=u.side,
            character=debate.character_of(u.side),
            text=u.text,
            caption=u.caption,
            empathy_count=cnt,
        )
        for u, cnt in rows
    ]
    return UtteranceList(items=items, status=debate.status, total=TOTAL_UTTERANCES)
