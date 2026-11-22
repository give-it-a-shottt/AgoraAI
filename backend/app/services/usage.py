"""하루 사용량 칸(daily_usage) — "세고 나서 만들기" 대신 "자리부터 잡고 만들기".

COUNT로 남은 횟수를 본 뒤 몇 초짜리 AI 확인을 하고 나서 INSERT하면, 그 사이에 들어온 같은 사람의 요청도
같은 "남음"을 보고 통과한다(F-007 R2). 그래서 `UPDATE … SET used = used + 1 WHERE used < limit` 한 문장으로
자리를 잡는다. 행 하나를 고치는 UPDATE는 DB가 줄을 세우므로(Postgres 행 잠금 · SQLite 쓰기 잠금) 한도를 넘지 않는다.
"""

import logging
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import DailyUsage
from app.timeutil import kst_today

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Slot:
    """잡은 자리. 되돌릴 때 같은 날짜 칸을 써야 자정을 넘겨도 맞다."""

    scope: str
    day: date


def _ensure_row(db: Session, scope: str, day: date) -> None:
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    db.execute(insert(DailyUsage).values(scope=scope, day=day, used=0).on_conflict_do_nothing())


def reserve(db: Session, scope: str, limit: int, day: date | None = None) -> Slot | None:
    """자리가 있으면 1 올리고 Slot, 없으면 None. 바로 commit해서 다른 요청이 곧바로 본다."""
    day = day or kst_today()
    _ensure_row(db, scope, day)
    result = db.execute(
        update(DailyUsage)
        .where(DailyUsage.scope == scope, DailyUsage.day == day, DailyUsage.used < limit)
        .values(used=DailyUsage.used + 1)
    )
    db.commit()
    return Slot(scope, day) if result.rowcount == 1 else None


def release(db: Session, slot: Slot | None) -> None:
    """거절·실패로 토론이 안 만들어졌으면 자리를 돌려준다(차감 없음)."""
    if slot is None:
        return
    db.rollback()  # 실패한 작업이 남긴 트랜잭션을 정리하고
    db.execute(
        update(DailyUsage)
        .where(DailyUsage.scope == slot.scope, DailyUsage.day == slot.day, DailyUsage.used > 0)
        .values(used=DailyUsage.used - 1)
    )
    db.commit()


def release_quietly(db: Session, slot: Slot | None) -> None:
    """실패 처리 중에 부른다. 돌려주기마저 실패해도(DB 장애) 원래 예외를 가리지 않게 기록만 한다."""
    try:
        release(db, slot)
    except Exception:
        logger.exception("daily_usage 자리 돌려주기 실패: %s", slot)


def used(db: Session, scope: str, day: date | None = None) -> int:
    return db.scalar(select(DailyUsage.used).where(DailyUsage.scope == scope, DailyUsage.day == (day or kst_today()))) or 0
