"""토론 만들기(F-007, CRT_01_001~007): 입력 정리 → 금지어 검수 → 하루 자리 잡기 → AI 주제 검수 → 생성 시작.
차감 규칙: 자리를 먼저 잡고(services/usage.py), 검수 거절·확인 실패면 돌려준다 — 횟수가 줄지 않는다.
AI 확인 자체도 사람당·전체 하루 횟수를 따로 센다(거절을 반복해 무료 한도를 쓰는 것 방지, F-007 R2).
"""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Debate, User
from app.providers import judge as judge_provider
from app.providers.base import ProviderError
from app.services import generation, usage
from app.services.moderation import check_topic_local
from app.services.normalize import normalized_key
from app.timeutil import kst_day_bounds_utc, kst_today

# 입력 규칙은 프론트 features/create/validate.ts와 같다. 바꿀 때 양쪽을 같이 고친다.
TOPIC_MIN, TOPIC_MAX = 2, 30
# 꺾쇠류는 밸런스 게임 주제에 필요 없고 프롬프트 태그 흉내에 쓰일 수 있어 받지 않는다(F-002 R2).
_FORBIDDEN_CHARS = re.compile(r"[<>＜＞〈〉《》‹›﹤﹥⟨⟩]")
_SPACES = re.compile(r"\s+")

# 거절 시 보여 줄 안전한 추천. 프론트는 이 응답 값을 그대로 보여 준다.
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


class CheckLimitReached(Exception):
    """사람당 하루 AI 주제 확인 횟수를 다 씀(거절이 반복된 경우)."""

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


def _user_scope(kind: str, user: User) -> str:
    return f"{kind}:user:{user.id}"


GLOBAL_CREATE, GLOBAL_CHECK = "create:global", "check:global"


def quota_of(db: Session, user: User, settings: Settings) -> Quota:
    """오늘 남은 만들기 횟수. 확인 중인 요청이 잡아 둔 자리도 쓴 것으로 본다."""
    used = usage.used(db, _user_scope("create", user))
    return Quota(remaining=max(0, settings.daily_user_limit - used), limit=settings.daily_user_limit, reset_at=_next_reset_utc())


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
    # 이미 AI 확인 횟수를 다 썼으면 자리를 잡았다 돌려주는 쓰기 없이 바로 거절(읽기만, 최종 판단은 아래 reserve)
    if usage.used(db, _user_scope("check", user)) >= settings.daily_user_checks:
        raise CheckLimitReached(_next_reset_utc())
    mine = usage.reserve(db, _user_scope("create", user), settings.daily_user_limit)
    if mine is None:
        raise UserLimitReached(_next_reset_utc())
    everyone: usage.Slot | None = None
    try:
        everyone = usage.reserve(db, GLOBAL_CREATE, settings.daily_global_limit)
        if everyone is None:
            raise GlobalClosed
        # AI 확인 횟수는 돌려주지 않는다(거절도 API를 쓴 것).
        my_check = usage.reserve(db, _user_scope("check", user), settings.daily_user_checks)
        if my_check is None:
            raise CheckLimitReached(_next_reset_utc())
        if usage.reserve(db, GLOBAL_CHECK, settings.daily_global_checks) is None:
            usage.release_quietly(db, my_check)  # AI를 부르지 않았으니 사람당 확인 횟수는 돌려준다
            raise GlobalClosed
        try:
            check = judge_provider().check_topic(topic_a, topic_b)
        except ProviderError as exc:
            raise CheckFailed from exc
        if not check.allowed:
            raise TopicRejected(check.reason or "토론하기 어려운 주제예요.")
        return generation.create_debate(db, topic_a, topic_b, creator_id=user.id)
    except BaseException:
        usage.release_quietly(db, everyone)
        usage.release_quietly(db, mine)
        raise
