"""시드 토론 넣기(§8: 출시 전 15~20개). 기본은 키가 있어도 mock으로 만든다(비용·한도 보호, Q-007).

사용: uv run python -m app.jobs.seed                 # 없는 주제만 mock으로 추가
      uv run python -m app.jobs.seed --reset         # 시드 토론을 지우고 다시
      uv run python -m app.jobs.seed --real          # 실제 AI로(키 필요, 18토론 × 6발언 + 판정 호출)
"""

import argparse
import logging
from datetime import timedelta

from sqlalchemy import delete, select

from app import db as db_module
from app import providers
from app.models import Debate
from app.services import generation
from app.services.normalize import normalized_key
from app.timeutil import kst_today

SEED_TOPICS: list[tuple[str, str]] = [
    ("평생 짜장", "평생 짬뽕"),
    ("탕수육 부먹", "찍먹"),
    ("평생 여름", "평생 겨울"),
    ("연락 자주 하는 연인", "가끔 하는 연인"),
    ("아침형 인간", "저녁형 인간"),
    ("평생 탄산 없이", "평생 커피 없이"),
    ("산", "바다"),
    ("민트초코", "반민초"),
    ("깻잎 논쟁 허용", "금지"),
    ("재택근무", "사무실 출근"),
    ("평생 라면만", "평생 김밥만"),
    ("여행은 계획파", "즉흥파"),
    ("고양이 집사", "강아지 보호자"),
    ("영화는 극장", "영화는 집에서"),
    ("돈 많은 백수", "바쁜 부자"),
    ("과거로 가기", "미래로 가기"),
    ("붕어빵 머리부터", "꼬리부터"),
    ("10억 받고 무인도 1년", "그냥 지금처럼"),
]

logger = logging.getLogger("agora.seed")


def seed(reset: bool = False, real: bool = False) -> dict[str, int]:
    """결과: {"created": 새로 만든 수, "done": 완료, "unfinished": 멈춤·생성 중으로 남은 수}"""
    providers.force_mock(not real)
    created_ids: list[str] = []
    try:
        _create_all(reset, created_ids)
    finally:
        providers.force_mock(False)
    with db_module.SessionLocal() as db:
        statuses = [db.get(Debate, i).status for i in created_ids]
    done = statuses.count("done")
    if done < len(statuses):
        logger.warning("시드 %s개 중 %s개가 완료되지 않았어요(멈춤·생성 중).", len(statuses), len(statuses) - done)
    return {"created": len(created_ids), "done": done, "unfinished": len(statuses) - done}


def _create_all(reset: bool, created_ids: list[str]) -> None:
    with db_module.SessionLocal() as db:
        if reset:
            db.execute(delete(Debate).where(Debate.is_seed.is_(True)))
            db.commit()
        existing = set(db.scalars(select(Debate.normalized_key)))
        today = kst_today()
        for index, (a, b) in enumerate(SEED_TOPICS):
            if normalized_key(a, b) in existing:
                continue
            # 첫 주제는 오늘의 토론, 나머지는 지난 오늘의 토론처럼 날짜를 하루씩 앞당겨 둔다.
            debate = generation.create_debate(db, a, b, is_seed=True, today_date=today - timedelta(days=index))
            debate.created_at = debate.created_at - timedelta(days=index)
            db.commit()
            generation.run_until_done(debate.id)
            created_ids.append(debate.id)
            logger.info("시드 %s vs %s → %s", a, b, debate.id)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--real", action="store_true", help="실제 AI 공급자로 생성(비용 발생)")
    args = parser.parse_args()
    result = seed(reset=args.reset, real=args.real)
    print(f"시드 토론 {result['created']}개 추가 (완료 {result['done']}, 미완료 {result['unfinished']})")
