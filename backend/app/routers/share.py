"""공유 주소와 미리보기 이미지(F-006). /share/{id} → OG 태그가 든 HTML → 실제 화면(승부 예측)으로 이동."""

from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse

from app.config import get_settings
from app.deps import DB, DebateId, load_debate
from app.services import share

router = APIRouter(tags=["share"])

# s-maxage: Vercel CDN이 엣지에 캐시하게(같은 요청이 함수 실행을 반복하지 않게). 가려진 토론은 짧게.
CACHE_PAGE = "public, max-age=300, s-maxage=300"
CACHE_IMAGE = "public, max-age=86400, s-maxage=86400, immutable"
CACHE_HIDDEN = "public, max-age=60, s-maxage=60"


@router.get("/share/{debate_id}", response_class=HTMLResponse)
def share_page(debate_id: DebateId, db: DB) -> HTMLResponse:
    # 가려진 토론도 이동은 시킨다(화면이 DEB_01_008 안내를 보여 줌). 미리보기에는 주제를 넣지 않는다.
    debate = load_debate(db, debate_id)
    return HTMLResponse(
        share.share_html(debate, get_settings().public_base_url),
        headers={"Cache-Control": CACHE_HIDDEN if debate.is_hidden else CACHE_PAGE},
    )


@router.get("/api/og/{debate_id}.png")
def og_image(debate_id: DebateId, db: DB) -> Response:
    debate = load_debate(db, debate_id)
    return Response(
        share.og_image(debate),
        media_type="image/png",
        headers={"Cache-Control": CACHE_HIDDEN if debate.is_hidden else CACHE_IMAGE},
    )
