"""무대 공감 API(F-004, §0-3 "발언마다 공감 한 번 탭"). 로그인 없이 브라우저 번호로 발언당 1번."""

from typing import Annotated

from fastapi import APIRouter, Path

from app.deps import DB, BrowserId, ClientKey, load_visible_debate
from app.errors import api_error
from app.models import Utterance
from app.schemas import EmpathyOut
from app.services import audience, throttle

router = APIRouter(prefix="/api/utterances", tags=["empathy"])


@router.post("/{utterance_id}/empathy", response_model=EmpathyOut)
def empathize(utterance_id: Annotated[int, Path(ge=1)], db: DB, browser: BrowserId, client: ClientKey) -> EmpathyOut:
    utterance = db.get(Utterance, utterance_id)
    if utterance is None:
        raise api_error(404, "not_found", "없는 발언이에요.")
    load_visible_debate(db, utterance.debate_id)  # 가려진 토론이면 410
    try:
        return EmpathyOut(count=audience.empathize(db, utterance_id, browser, client), empathized=True)
    except throttle.RateLimited as exc:
        raise api_error(429, "too_many_requests", "잠시 뒤에 다시 시도해 주세요.", retry_after=exc.retry_after) from None
