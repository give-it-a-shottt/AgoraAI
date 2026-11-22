"""시간 유틸. DB에는 UTC(타임존 없는 값)로 저장하고, '오늘'은 한국 시간 기준으로 계산한다."""

from datetime import UTC, date, datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def kst_today(now: datetime | None = None) -> date:
    now_utc = (now or utcnow()).replace(tzinfo=UTC)
    return now_utc.astimezone(KST).date()


def kst_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """한국 날짜 하루의 시작·끝을 UTC(타임존 없는 값)로."""
    start = datetime(day.year, day.month, day.day, tzinfo=KST).astimezone(UTC).replace(tzinfo=None)
    return start, start + timedelta(days=1)
