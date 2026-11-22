"""결과·판정 다시 시도·신고 API(F-005)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header

from app.deps import DB, BrowserId, ClientKey, DebateId, load_visible_debate
from app.errors import api_error
from app.schemas import ReportIn, ReportOut, ResultOut
from app.services import judging, results, throttle

router = APIRouter(prefix="/api/debates", tags=["results"])


def _optional_browser(x_browser_id: str | None) -> str | None:
    try:
        return str(uuid.UUID(x_browser_id or ""))
    except ValueError:
        return None  # 결과는 브라우저 번호 없이도 볼 수 있다(내 예측만 빠짐)


def _finished_debate(db, debate_id: str):
    debate = load_visible_debate(db, debate_id)
    if debate.status != "done":
        raise api_error(409, "not_finished", "아직 토론이 끝나지 않았어요.")
    return debate


@router.get("/{debate_id}/result", response_model=ResultOut)
def result(
    debate_id: DebateId,
    db: DB,
    background: BackgroundTasks,
    x_browser_id: Annotated[str | None, Header()] = None,
) -> ResultOut:
    debate = _finished_debate(db, debate_id)
    judging.settle_stuck(db, debate)
    if judging.needs_judging(debate):
        background.add_task(judging.judge_debate, debate.id)
    return results.result_of(db, debate, _optional_browser(x_browser_id))


@router.post("/{debate_id}/judge/retry", response_model=ResultOut)
def retry_judge(debate_id: DebateId, db: DB, browser: BrowserId, background: BackgroundTasks) -> ResultOut:
    debate = _finished_debate(db, debate_id)
    judging.settle_stuck(db, debate)
    if debate.judge_status != "failed":
        raise api_error(409, "not_failed", "지금은 다시 판정할 필요가 없어요.")
    if debate.judge_attempts >= judging.MAX_JUDGE_ATTEMPTS:
        raise api_error(409, "judge_limit", "판정을 더 시도할 수 없어요. 발언은 그대로 볼 수 있어요.")
    if not judging.queue_retry(db, debate):
        raise api_error(409, "not_failed", "지금은 다시 판정할 필요가 없어요.")
    # 판정은 백그라운드로 — 응답은 바로 pending을 주고, 화면은 결과를 다시 읽어 받는다.
    background.add_task(judging.judge_debate, debate.id)
    return results.result_of(db, debate, browser)


@router.post("/{debate_id}/reports", response_model=ReportOut)
def report(debate_id: DebateId, body: ReportIn, db: DB, browser: BrowserId, client: ClientKey) -> ReportOut:
    debate = load_visible_debate(db, debate_id)
    try:
        hidden = results.report(db, debate, browser, body.reason, client)
    except throttle.RateLimited as exc:
        raise api_error(429, "too_many_requests", "잠시 뒤에 다시 시도해 주세요.", retry_after=exc.retry_after) from None
    return ReportOut(reported=True, hidden=hidden)
