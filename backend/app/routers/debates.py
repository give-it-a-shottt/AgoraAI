"""토론 조회 API (홈·상세)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Debate
from app.schemas import DebateDetail, DebateList, DebateSummary
from app.services import debate_query

router = APIRouter(prefix="/api/debates", tags=["debates"])
DB = Annotated[Session, Depends(get_db)]


def get_debate_or_404(db: Session, debate_id: str) -> Debate:
    debate = db.get(Debate, debate_id)
    if debate is None:
        raise api_error(404, "not_found", "없는 토론이에요.")
    return debate


@router.get("/today", response_model=DebateSummary)
def today(db: DB) -> DebateSummary:
    debate = debate_query.get_today_debate(db)
    if debate is None:
        raise api_error(404, "no_today", "오늘의 토론이 아직 없어요.")
    return debate_query.to_summary(debate, debate_query.prediction_count(db, debate.id))


@router.get("", response_model=DebateList)
def list_debates(
    db: DB,
    sort: Annotated[debate_query.Sort, Query()] = "popular",
    page: Annotated[int, Query(ge=1, le=1000)] = 1,
    size: Annotated[int, Query(ge=1, le=20)] = 5,
) -> DebateList:
    return debate_query.list_debates(db, sort, page, size)


@router.get("/{debate_id}", response_model=DebateDetail)
def detail(debate_id: str, db: DB) -> DebateDetail:
    debate = get_debate_or_404(db, debate_id)
    if debate.is_hidden:
        # 가려진 토론(DEB_01_008)은 주제만 알려 주고 나머지는 숨긴다.
        detail = debate_query.to_detail(db, debate)
        return detail.model_copy(update={"utterance_count": 0, "prediction_count": 0})
    return debate_query.to_detail(db, debate)
