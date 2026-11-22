"""Vercel Cron 전용 API(F-008). Vercel은 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 GET으로 부른다."""

import secrets
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header

from app.config import get_settings
from app.deps import DB
from app.errors import api_error
from app.services import generation, today

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _check_secret(authorization: str | None) -> None:
    secret = get_settings().cron_secret
    if not secret:  # 설정이 없으면 아무도 못 부르게(빈 비밀값과 빈 헤더가 같다고 통과시키지 않음)
        raise api_error(503, "cron_not_configured", "예약 작업이 설정되지 않았어요.")
    if not secrets.compare_digest((authorization or "").encode(), f"Bearer {secret}".encode()):
        raise api_error(401, "unauthorized", "권한이 없어요.")


@router.get("/today")
def run_today(
    db: DB,
    background: BackgroundTasks,
    authorization: Annotated[str | None, Header(max_length=512)] = None,
) -> dict:
    _check_secret(authorization)
    result = today.ensure_today(db)
    if result.created and result.debate is not None:
        background.add_task(generation.run_until_done, result.debate.id)
    return {"debate_id": result.debate.id if result.debate else None, "source": result.source, "created": result.created}
