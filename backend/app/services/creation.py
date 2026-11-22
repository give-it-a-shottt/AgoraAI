"""토론 만들기(F-007, CRT_01_001~007): 입력 정리 → 금지어 검수 → 하루 한도 → AI 주제 검수 → 생성 시작.
차감 규칙: 검수 거절·확인 실패는 토론이 만들어지지 않으므로 횟수가 줄지 않는다(만든 토론 수로 센다).
"""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Debate, User
from app.providers import judge as judge_provider
from app.providers.base import ProviderError
from app.services import generation
from app.services.moderation import check_topic_local
from app.services.normalize import normalized_key
from app.timeutil import kst_day_bounds_utc, kst_today

TOPIC_MIN, TOPIC_MAX = 2, 30
# 꺾쇠류는 밸런스 게임 주제에 필요 없고 프롬프트 태그 흉내에 쓰일 수 있어 받지 않는다(F-002 R2).
_FORBIDDEN_CHARS = re.compile(r"[<>＜＞〈〉《》‹›﹤﹥⟨⟩]")
_SPACES = re.compile(r"\s+")

# 거절 시 보여 줄 안전한 추천(프론트 features/create/suggestions.ts와 같은 목록의 앞부분)
SAFE_SUGGESTIONS = [("등산", "바다"), ("민트초코", "반민초"), ("평생 짜장", "평생 짬뽕")]


class TopicInvalid(Exception):
    def __init__(self, message: str):
        self.message = message


class TopicRejected(Exception):
    def __init__(self, reason: str):
        self.reason = reason


class UserLimitReached(Exception):
    def __init__(self, reset_at: datetime):
        self.reset_at = reset_at


class GlobalClosed(Exception):
    pass


class CheckFailed(Exception):
    pass


@dataclass(frozen=True)
class Quota:
    remaining: int
    limit: int
    reset_at: datetime  # 한국 시간 다음 날 0시(UTC로)


def clean_topic(value: str) -> str:
    text = _SPACES.sub(" ", value).strip()
    if not TOPIC_MIN <= len(text) <= TOPIC_MAX:
        raise TopicInvalid(f"선택지는 {TOPIC_MIN}~{TOPIC_MAX}자로 써 주세요.")
    if _FORBIDDEN_CHARS.search(text):
        raise TopicInvalid("꺾쇠(< >) 같은 기호는 쓸 수 없어요.")
    return text


def _next_reset_utc() -> datetime:
    start, _ = kst_day_bounds_utc(kst_today() + timedelta(days=1))
    return start


def quota_of(db: Session, user: User, settings: Settings) -> Quota:
    start, end = kst_day_bounds_utc(kst_today())
    used = db.scalar(
        select(func.count(Debate.id)).where(Debate.creator_id == user.id, Debate.created_at >= start, Debate.created_at < end)
    ) or 0
    return Quota(remaining=max(0, settings.daily_user_limit - used), limit=settings.daily_user_limit, reset_at=_next_reset_utc())


def _global_used_today(db: Session) -> int:
    """오늘 사용자가 만든 토론 수(시드·오늘의 토론 제외) — 무료 API 한도 보호용 전체 마감(Q-002)."""
    start, end = kst_day_bounds_utc(kst_today())
    return db.scalar(
        select(func.count(Debate.id)).where(
            Debate.creator_id.is_not(None), Debate.created_at >= start, Debate.created_at < end
        )
    ) or 0


def find_similar(db: Session, topic_a: str, topic_b: str) -> Debate | None:
    """띄어쓰기·대소문자·순서만 다른 같은 주제(가려지지 않은 것)."""
    return db.scalar(
        select(Debate)
        .where(Debate.normalized_key == normalized_key(topic_a, topic_b), Debate.is_hidden.is_(False))
        .order_by(Debate.created_at.desc())
        .limit(1)
    )


def create(db: Session, user: User, raw_a: str, raw_b: str, settings: Settings) -> Debate:
    topic_a, topic_b = clean_topic(raw_a), clean_topic(raw_b)
    local = check_topic_local(topic_a, topic_b)
    if not local.allowed:
        raise TopicRejected(local.reason)
    quota = quota_of(db, user, settings)
    if quota.remaining <= 0:
        raise UserLimitReached(quota.reset_at)
    if _global_used_today(db) >= settings.daily_global_limit:
        raise GlobalClosed
    try:
        check = judge_provider().check_topic(topic_a, topic_b)
    except ProviderError as exc:
        raise CheckFailed from exc
    if not check.allowed:
        raise TopicRejected(check.reason or "토론하기 어려운 주제예요.")
    return generation.create_debate(db, topic_a, topic_b, creator_id=user.id)

