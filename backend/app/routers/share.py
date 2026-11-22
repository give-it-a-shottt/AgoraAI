"""공유 주소와 미리보기 이미지(F-006). /share/{id} → OG 태그가 든 HTML → 실제 화면(승부 예측)으로 이동."""

from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse

from app.config import get_settings
from app.deps import DB, DebateId
from app.errors import api_error
from app.models import Debate
from app.services import share

router = APIRouter(tags=["share"])


def _debate(db, debate_id: str) -> Debate:
    debate = db.get(Debate, debate_id)
    if debate is None:
        raise api_error(404, "not_found", "없는 토론이에요.")
    return debate


@router.get("/share/{debate_id}", response_class=HTMLResponse)
def share_page(debate_id: DebateId, db: DB) -> HTMLResponse:
    debate = _debate(db, debate_id)
    # 가려진 토론도 이동은 시킨다(화면이 DEB_01_008 안내를 보여 줌). 미리보기는 주제만이라 승자는 없다.
    return HTMLResponse(
        share.share_html(debate, get_settings().public_base_url),
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/api/og/{debate_id}.png")
def og_image(debate_id: DebateId, db: DB) -> Response:
    debate = _debate(db, debate_id)
    return Response(
        share.og_image(debate),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},  # 주제는 바뀌지 않아 하루 캐시
    )
