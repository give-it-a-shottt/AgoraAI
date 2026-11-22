"""관객 행동(로그인 없이 브라우저 번호로 1회): 승부 예측·공감. 같은 브라우저가 다시 보내도 한 번만 센다."""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Empathy, Prediction
from app.services import throttle


def my_prediction(db: Session, debate_id: str, browser_id: str) -> str | None:
    return db.scalar(
        select(Prediction.pick).where(Prediction.debate_id == debate_id, Prediction.browser_id == browser_id)
    )


def predict(db: Session, debate_id: str, browser_id: str, pick: str, client: str) -> str:
    """처음 한 예측만 인정한다(UNIQUE(debate_id, browser_id)). 동시에 두 번 와도 DB가 하나만 남긴다.
    새 예측은 접속자(IP 해시)당 요청 수 제한을 거친다(throttle.RateLimited)."""
    existing = my_prediction(db, debate_id, browser_id)
    if existing is not None:
        return existing
    throttle.ensure_allowed(db, Prediction, client, throttle.PREDICTION_LIMIT)
    db.add(Prediction(debate_id=debate_id, browser_id=browser_id, pick=pick, client_hash=client))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        saved = my_prediction(db, debate_id, browser_id)
        if saved is None:
            raise  # 같은 브라우저 중복이 아닌 다른 제약 위반 → 500으로
        return saved
    return pick


def empathy_count(db: Session, utterance_id: int) -> int:
    return db.scalar(select(func.count(Empathy.id)).where(Empathy.utterance_id == utterance_id)) or 0


def _already_empathized(db: Session, utterance_id: int, browser_id: str) -> bool:
    return (
        db.scalar(select(Empathy.id).where(Empathy.utterance_id == utterance_id, Empathy.browser_id == browser_id))
        is not None
    )


def empathize(db: Session, utterance_id: int, browser_id: str, client: str) -> int:
    """발언마다 공감은 브라우저당 한 번(UNIQUE(utterance_id, browser_id)). 다시 눌러도 늘지 않는다."""
    if _already_empathized(db, utterance_id, browser_id):
        return empathy_count(db, utterance_id)
    throttle.ensure_allowed(db, Empathy, client, throttle.EMPATHY_LIMIT)
    db.add(Empathy(utterance_id=utterance_id, browser_id=browser_id, client_hash=client))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if not _already_empathized(db, utterance_id, browser_id):
            raise  # 같은 브라우저 중복이 아닌 다른 제약 위반 → 500으로(성공처럼 숨기지 않음)
    return empathy_count(db, utterance_id)
