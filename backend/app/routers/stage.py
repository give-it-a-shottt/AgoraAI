"""무대가 읽는 발언 목록과 멈춘 생성 재시도 API(F-002). 화면은 DB에 쌓인 발언만 읽는다(D-003)."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import TOTAL_UTTERANCES, Debate, Empathy, Utterance
from app.schemas import StatusOut, UtteranceList, UtteranceOut
from app.services import generation

router = APIRouter(prefix="/api/debates", tags=["stage"])
DB = Annotated[Session, Depends(get_db)]
DebateId = Annotated[str, Path(min_length=1, max_length=16)]


def load_visible_debate(db: Session, debate_id: str) -> Debate:
    debate = db.get(Debate, debate_id)
    if debate is None:
        raise api_error(404, "not_found", "없는 토론이에요.")
    if debate.is_hidden:
        raise api_error(410, "hidden", "신고가 많아 가려진 토론이에요.")
    return debate


@router.get("/{debate_id}/utterances", response_model=UtteranceList)
def utterances(
    debate_id: DebateId,
    db: DB,
    background: BackgroundTasks,
    after: Annotated[int, Query(ge=0, le=TOTAL_UTTERANCES)] = 0,
) -> UtteranceList:
    debate = load_visible_debate(db, debate_id)
    if generation.needs_kick(db, debate):
        background.add_task(generation.run_until_done, debate.id)

    empathy_count = (
        select(Empathy.utterance_id, func.count(Empathy.id).label("cnt")).group_by(Empathy.utterance_id).subquery()
    )
    rows = db.execute(
        select(Utterance, func.coalesce(empathy_count.c.cnt, 0))
        .outerjoin(empathy_count, empathy_count.c.utterance_id == Utterance.id)
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


@router.post("/{debate_id}/retry", response_model=StatusOut)
def retry(debate_id: DebateId, db: DB, background: BackgroundTasks) -> StatusOut:
    debate = load_visible_debate(db, debate_id)
    try:
        generation.retry(db, debate)
    except generation.NotPaused:
        raise api_error(409, "not_paused", "지금은 다시 시도할 필요가 없어요.") from None
    background.add_task(generation.run_until_done, debate.id)
    return StatusOut(status=debate.status)
