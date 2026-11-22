"""무대가 읽는 발언 목록과 멈춘 생성 재시도 API(F-002). 화면은 DB에 쌓인 발언만 읽는다(D-003)."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query

from app.deps import DB, DebateId, load_visible_debate
from app.errors import api_error
from app.models import TOTAL_UTTERANCES
from app.schemas import StatusOut, UtteranceList
from app.services import debate_query, generation

router = APIRouter(prefix="/api/debates", tags=["stage"])


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
    return debate_query.list_utterances(db, debate, after)


@router.post("/{debate_id}/retry", response_model=StatusOut)
def retry(debate_id: DebateId, db: DB, background: BackgroundTasks) -> StatusOut:
    debate = load_visible_debate(db, debate_id)
    try:
        generation.retry(db, debate)
    except generation.NotPaused:
        raise api_error(409, "not_paused", "지금은 다시 시도할 필요가 없어요.") from None
    except generation.RetryLimitReached:
        raise api_error(409, "retry_limit", "이 토론은 더 이어서 만들 수 없어요. 다른 토론을 봐 주세요.") from None
    except generation.RetryTooSoon as exc:
        raise api_error(
            429, "retry_too_soon", "잠시 뒤에 다시 시도해 주세요.", retry_after=exc.seconds_left
        ) from None
    background.add_task(generation.run_until_done, debate.id)
    return StatusOut(status=debate.status)
