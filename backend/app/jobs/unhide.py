"""신고로 가려진 토론을 다시 보이게 한다(§0-4 "숨김 되돌리기(DB 표시)" — 관리 화면 없이 운영자가 직접).

사용: uv run python -m app.jobs.unhide <토론ID> [--clear-reports]
"""

import argparse

from sqlalchemy import delete

from app import db as db_module
from app.models import Debate, Report


def unhide(debate_id: str, clear_reports: bool = False) -> bool:
    with db_module.SessionLocal() as s:
        debate = s.get(Debate, debate_id)
        if debate is None:
            return False
        debate.is_hidden = False
        if clear_reports:
            s.execute(delete(Report).where(Report.debate_id == debate_id))  # 다시 3명이 신고해야 가려지게
        s.commit()
        return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("debate_id")
    parser.add_argument("--clear-reports", action="store_true")
    args = parser.parse_args()
    print("되돌림" if unhide(args.debate_id, args.clear_reports) else "없는 토론")
