"""토론 만들기 API(F-007). 로그인 필요. ⚠️ /api/debates/similar는 /api/debates/{id}보다 먼저 등록돼야 한다(main.py 순서)."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query

from app.config import get_settings
from app.deps import DB, LoggedInUser
from app.errors import api_error
from app.schemas import CreateDebateIn, CreateDebateOut, QuotaOut, SimilarOut
from app.services import creation, debate_query, generation

router = APIRouter(tags=["create"])


@router.get("/api/debates/similar", response_model=SimilarOut)
def similar(
    db: DB,
    a: Annotated[str, Query(min_length=1, max_length=60)],
    b: Annotated[str, Query(min_length=1, max_length=60)],
) -> SimilarOut:
    found = creation.find_similar(db, a, b)
    return SimilarOut(debate=debate_query.to_summary(found, debate_query.prediction_count(db, found.id)) if found else None)


@router.get("/api/me/quota", response_model=QuotaOut)
def quota(db: DB, user: LoggedInUser) -> QuotaOut:
    q = creation.quota_of(db, user, get_settings())
    return QuotaOut(remaining=q.remaining, limit=q.limit, reset_at=q.reset_at)


@router.post("/api/debates", response_model=CreateDebateOut, status_code=201)
def create(body: CreateDebateIn, db: DB, user: LoggedInUser, background: BackgroundTasks) -> CreateDebateOut:
    try:
        debate = creation.create(db, user, body.topic_a, body.topic_b, get_settings())
    except creation.TopicInvalid as exc:
        raise api_error(422, "topic_invalid", exc.message) from None
    except creation.TopicRejected as exc:
        suggestions = [{"a": a, "b": b} for a, b in creation.SAFE_SUGGESTIONS]
        raise api_error(422, "topic_rejected", exc.reason, suggestions=suggestions) from None
    except creation.UserLimitReached as exc:
        raise api_error(429, "user_limit", "오늘 만들 수 있는 토론을 다 썼어요.", reset_at=exc.reset_at.isoformat()) from None
    except creation.GlobalClosed:
        raise api_error(503, "global_closed", "오늘은 토론 생성이 마감됐어요. 내일 다시 만들어 주세요.") from None
    except creation.CheckFailed:
        raise api_error(502, "check_failed", "주제를 확인하지 못했어요. 다시 시도해 주세요.") from None
    background.add_task(generation.run_until_done, debate.id)
    return CreateDebateOut(id=debate.id)
