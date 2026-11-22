"""토론 조회 API (홈·상세). 판단은 services/debate_query.py에서 하고 여기서는 응답·404만."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.schemas import DebateDetail, DebateList, DebateSummary
from app.services import debate_query

router = APIRouter(prefix="/api/debates", tags=["debates"])
DB = Annotated[Session, Depends(get_db)]
DebateId = Annotated[str, Path(min_length=1, max_length=16)]

MAX_PAGE = 1000
MAX_PAGE_SIZE = 20


@router.get("/today", response_model=DebateSummary)
def today(db: DB) -> DebateSummary:
    summary = debate_query.get_today_summary(db)
    if summary is None:
        raise api_error(404, "no_today", "아직 토론이 없어요.")
    return summary


@router.get("", response_model=DebateList)
def list_debates(
    db: DB,
    sort: Annotated[debate_query.Sort, Query()] = "popular",
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 5,
) -> DebateList:
    return debate_query.list_debates(db, sort, page, size)


@router.get("/{debate_id}", response_model=DebateDetail)
def detail(debate_id: DebateId, db: DB) -> DebateDetail:
    found = debate_query.get_detail(db, debate_id)
    if found is None:
        raise api_error(404, "not_found", "없는 토론이에요.")
    return found
