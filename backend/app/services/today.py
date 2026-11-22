"""오늘의 토론 하루 1회(F-008, §8 "Vercel Cron 하루 1회", §0-3 "오늘의 토론 하루 1회 자동 생성").

순서(Q-020 임시 처리): 이미 오늘 걸린 토론이 있으면 그대로 → 준비한 주제 목록에서 아직 없는 주제로 새로 생성
→ 목록을 다 썼으면 한 번도 안 걸린 완료 토론 중 예측이 가장 많은 것을 오늘의 토론으로 올림.
Cron이 재시도로 두 번 와도 하루 한 번만 만들도록 하루 사용량 칸(daily_usage)으로 자리를 잡는다.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Debate, Prediction
from app.services import generation, usage
from app.services.normalize import normalized_key
from app.timeutil import kst_today

# 운영자가 고른 가벼운 밸런스 게임(시드와 겹치지 않게). 금지 주제 검수는 사람이 이미 한 것으로 본다.
TODAY_TOPICS: list[tuple[str, str]] = [
    ("평생 치킨만", "평생 피자만"),
    ("투명 인간 되기", "하늘 날기"),
    ("겨울 바다", "여름 계곡"),
    ("카톡 답장 바로", "카톡 답장 천천히"),
    ("월요병 없는 삶", "일요일 하루 더"),
    ("평생 엘리베이터", "평생 계단"),
    ("떡볶이 밀떡", "떡볶이 쌀떡"),
    ("휴가는 산으로", "휴가는 도시로"),
    ("알람 한 번에 기상", "알람 다섯 번"),
    ("평생 반팔", "평생 긴팔"),
    ("순대 소금", "순대 막장"),
    ("집에서 혼밥", "식당에서 혼밥"),
    ("시험 전날 벼락치기", "한 달 전부터 조금씩"),
    ("눈치 빠른 친구", "솔직한 친구"),
    ("여행 사진 많이", "여행은 눈으로만"),
    ("콩국수 설탕", "콩국수 소금"),
    ("평생 아이스", "평생 따뜻한 음료"),
    ("주말엔 집콕", "주말엔 외출"),
    ("빠른 답장 느린 연애", "느린 답장 빠른 연애"),
    ("팥붕", "슈붕"),
]

TODAY_SCOPE = "cron:today"

Source = Literal["existing", "pool", "promoted"]


@dataclass(frozen=True)
class TodayResult:
    debate: Debate | None
    source: Source | None
    created: bool  # 새 토론을 만들었으면 생성 작업을 돌려야 한다


def current_today(db: Session) -> Debate | None:
    return db.scalar(
        select(Debate)
        .where(Debate.today_date == kst_today(), Debate.is_hidden.is_(False))
        .order_by(Debate.created_at.desc())
        .limit(1)
    )


def _unused_topic(db: Session) -> tuple[str, str] | None:
    keys = {normalized_key(a, b): (a, b) for a, b in TODAY_TOPICS}
    taken = set(db.scalars(select(Debate.normalized_key).where(Debate.normalized_key.in_(keys))))
    return next((pair for key, pair in keys.items() if key not in taken), None)


def _most_predicted_unfeatured(db: Session) -> Debate | None:
    count = func.count(Prediction.id)
    return db.scalar(
        select(Debate)
        .outerjoin(Prediction, Prediction.debate_id == Debate.id)
        .where(Debate.status == "done", Debate.is_hidden.is_(False), Debate.today_date.is_(None))
        .group_by(Debate.id)
        .order_by(count.desc(), Debate.created_at.desc())
        .limit(1)
    )


def ensure_today(db: Session) -> TodayResult:
    existing = current_today(db)
    if existing is not None:
        return TodayResult(existing, "existing", False)
    today = kst_today()
    if usage.reserve(db, TODAY_SCOPE, 1, day=today) is None:
        # 같은 날 다른 호출이 이미 처리 중이거나 처리함(가려진 토론이었을 수도) — 두 번 만들지 않는다
        return TodayResult(current_today(db), "existing" if current_today(db) else None, False)
    topic = _unused_topic(db)
    if topic is not None:
        debate = generation.create_debate(db, topic[0], topic[1], today_date=today)
        return TodayResult(debate, "pool", True)
    promoted = _most_predicted_unfeatured(db)
    if promoted is not None:
        promoted.today_date = today
        db.commit()
        return TodayResult(promoted, "promoted", False)
    return TodayResult(None, None, False)
