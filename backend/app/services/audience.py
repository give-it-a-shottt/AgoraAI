"""관객 행동(로그인 없이 브라우저 번호로 1회): 승부 예측. 같은 브라우저가 다시 보내면 처음 값을 돌려준다."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Prediction


def my_prediction(db: Session, debate_id: str, browser_id: str) -> str | None:
    return db.scalar(
        select(Prediction.pick).where(Prediction.debate_id == debate_id, Prediction.browser_id == browser_id)
    )


def predict(db: Session, debate_id: str, browser_id: str, pick: str) -> str:
    """처음 한 예측만 인정한다(UNIQUE(debate_id, browser_id)). 동시에 두 번 와도 DB가 하나만 남긴다."""
    existing = my_prediction(db, debate_id, browser_id)
    if existing is not None:
        return existing
    db.add(Prediction(debate_id=debate_id, browser_id=browser_id, pick=pick))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return my_prediction(db, debate_id, browser_id) or pick
    return pick
