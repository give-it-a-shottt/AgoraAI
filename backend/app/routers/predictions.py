"""승부 예측 API(F-003, DEB_01_001). 로그인 없이 브라우저 번호로 토론당 1번."""

from fastapi import APIRouter

from app.deps import DB, BrowserId, ClientKey, DebateId, load_visible_debate
from app.errors import api_error
from app.schemas import PredictionIn, PredictionOut
from app.services import audience, throttle

router = APIRouter(prefix="/api/debates", tags=["predictions"])


@router.post("/{debate_id}/predictions", response_model=PredictionOut)
def predict(debate_id: DebateId, body: PredictionIn, db: DB, browser: BrowserId, client: ClientKey) -> PredictionOut:
    load_visible_debate(db, debate_id)
    try:
        return PredictionOut(pick=audience.predict(db, debate_id, browser, body.pick, client))
    except throttle.RateLimited as exc:
        raise api_error(429, "too_many_requests", "잠시 뒤에 다시 시도해 주세요.", retry_after=exc.retry_after) from None


@router.get("/{debate_id}/predictions/me", response_model=PredictionOut)
def my_prediction(debate_id: DebateId, db: DB, browser: BrowserId) -> PredictionOut:
    load_visible_debate(db, debate_id)
    return PredictionOut(pick=audience.my_prediction(db, debate_id, browser))
