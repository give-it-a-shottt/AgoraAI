"""로그인 없는 쓰기(예측·공감·신고)의 요청 수 제한.

browser_id는 브라우저가 만드는 값이라 새로 만들면 1회 제한을 우회할 수 있다(D-004에서 감수).
그래서 '양'은 접속 주소(IP) 기준으로 묶는다. IP 원문은 저장하지 않고, 서버 비밀값을 섞은 해시만 남긴다.
서버리스에서도 동작하게 메모리가 아니라 DB에 쌓인 행 수로 센다.
"""

import hashlib
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Empathy, Prediction, Report
from app.timeutil import utcnow


@dataclass(frozen=True)
class Limit:
    count: int
    window: timedelta


# 사람이 정상적으로 쓰는 양보다 넉넉하게: 10분에 토론 30개 예측, 발언 60개 공감, 1시간에 신고 10건.
PREDICTION_LIMIT = Limit(30, timedelta(minutes=10))
EMPATHY_LIMIT = Limit(60, timedelta(minutes=10))
REPORT_LIMIT = Limit(10, timedelta(hours=1))


class RateLimited(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after


def client_hash(ip: str, secret: str) -> str:
    return hashlib.sha256(f"{secret}:{ip}".encode()).hexdigest()[:32]


def ensure_allowed(db: Session, model: type[Prediction | Empathy | Report], key: str, limit: Limit) -> None:
    since = utcnow() - limit.window
    recent = db.scalar(
        select(func.count(model.id)).where(model.client_hash == key, model.created_at >= since)
    )
    if (recent or 0) >= limit.count:
        oldest = db.scalar(
            select(func.min(model.created_at)).where(model.client_hash == key, model.created_at >= since)
        )
        wait = (oldest + limit.window - utcnow()).total_seconds() if oldest else limit.window.total_seconds()
        raise RateLimited(max(1, int(wait) + 1))
