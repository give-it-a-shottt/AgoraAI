"""결과 화면 데이터(DEB_01_003). ⚠️ 승자를 내보내는 유일한 곳 — 토론이 끝난(done) 뒤에만."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Debate, Prediction, Report
from app.schemas import AudienceOut, MetricsOut, ResultOut
from app.services import audience

AUDIENCE_MIN = 5  # §0-4: 관객 판정은 5명 이상일 때만 보여 준다
HIDE_AFTER_REPORTS = 3  # §0-4 DEB_01_006: 신고 3건이면 가림
HUMAN_AGREEMENT: float | None = None  # 사람 분류와의 일치율(Q-004 — 측정 전이라 비움)


def audience_of(db: Session, debate_id: str) -> AudienceOut:
    rows = dict(
        db.execute(
            select(Prediction.pick, func.count(Prediction.id))
            .where(Prediction.debate_id == debate_id)
            .group_by(Prediction.pick)
        ).all()
    )
    count = sum(rows.values())
    if count < AUDIENCE_MIN:
        return AudienceOut(count=count, a_ratio=None, b_ratio=None)
    return AudienceOut(count=count, a_ratio=rows.get("A", 0) / count, b_ratio=rows.get("B", 0) / count)


def result_of(db: Session, debate: Debate, browser_id: str | None) -> ResultOut:
    done = debate.judge_status == "done"
    return ResultOut(
        judge_status=debate.judge_status,
        winner=debate.winner if done else None,
        judge_reason=debate.judge_reason if done else None,
        my_prediction=audience.my_prediction(db, debate.id, browser_id) if browser_id else None,
        audience=audience_of(db, debate.id),
        metrics=MetricsOut(
            rebut_rate=debate.rebut_rate if done else None,
            agree_rate=debate.agree_rate if done else None,
            human_agreement=HUMAN_AGREEMENT,
        ),
    )


def report(db: Session, debate: Debate, browser_id: str, reason: str, client: str) -> bool:
    """신고를 남기고(브라우저당 1번), 3건이 되면 가린다. 가려졌는지를 돌려준다."""
    from sqlalchemy.exc import IntegrityError

    from app.services import throttle

    already = db.scalar(select(Report.id).where(Report.debate_id == debate.id, Report.browser_id == browser_id))
    if already is None:
        throttle.ensure_allowed(db, Report, client, throttle.REPORT_LIMIT)
        db.add(Report(debate_id=debate.id, browser_id=browser_id, reason=reason, client_hash=client))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    total = db.scalar(select(func.count(Report.id)).where(Report.debate_id == debate.id)) or 0
    if total >= HIDE_AFTER_REPORTS and not debate.is_hidden:
        debate.is_hidden = True
        db.commit()
    return debate.is_hidden
