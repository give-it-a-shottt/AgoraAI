"""테스트용 데이터 만들기 도우미."""

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.models import Debate, Prediction, Utterance
from app.services.normalize import normalized_key


def make_debate(
    db: Session,
    a: str = "짜장",
    b: str = "짬뽕",
    *,
    status: str = "done",
    today_date: date | None = None,
    created_at: datetime | None = None,
    winner: str | None = "B",
    hidden: bool = False,
    cat_side: str = "A",
    predictions: int = 0,
    utterances: int = 0,
) -> Debate:
    debate = Debate(
        topic_a=a,
        topic_b=b,
        normalized_key=normalized_key(a, b),
        cat_side=cat_side,
        status=status,
        today_date=today_date,
        winner=winner,
        judge_status="done" if winner else "pending",
        is_hidden=hidden,
    )
    if created_at:
        debate.created_at = created_at
    db.add(debate)
    db.flush()
    for i in range(predictions):
        db.add(Prediction(debate_id=debate.id, browser_id=f"b-{debate.id}-{i}", pick="A"))
    for seq in range(1, utterances + 1):
        side = "A" if seq % 2 else "B"
        db.add(
            Utterance(
                debate_id=debate.id,
                seq=seq,
                round=(seq + 1) // 2,
                side=side,
                text=f"{seq}번째 발언",
                caption=f"자막 {seq}",
            )
        )
    db.commit()
    return debate
