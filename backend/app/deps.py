"""라우터 공통 의존성: DB 세션, 토론 ID 경로 값, 브라우저 번호(X-Browser-Id)."""

import uuid
from typing import Annotated

from fastapi import Depends, Header, Path, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import api_error
from app.models import Debate
from app.services.throttle import client_hash

DB = Annotated[Session, Depends(get_db)]
DebateId = Annotated[str, Path(min_length=1, max_length=16)]


def browser_id(x_browser_id: Annotated[str | None, Header()] = None) -> str:
    """로그인 없는 1회 제한(예측·공감·신고)용 번호. UUID 모양만 받는다."""
    try:
        return str(uuid.UUID(x_browser_id or ""))
    except ValueError:
        raise api_error(400, "browser_id_required", "브라우저 정보를 확인하지 못했어요. 새로고침해 주세요.") from None


BrowserId = Annotated[str, Depends(browser_id)]


def client_key(request: Request) -> str:
    """요청 수 제한용 접속자 키(IP 해시). IP 원문은 어디에도 저장하지 않는다."""
    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
    return client_hash(ip, settings.session_secret)


ClientKey = Annotated[str, Depends(client_key)]


def load_visible_debate(db: Session, debate_id: str) -> Debate:
    """발언·예측·공감·신고처럼 토론 '안'을 다루는 API용: 없으면 404, 가려졌으면 410.
    상세(GET /api/debates/{id})만 예외로 200 + hidden=true를 준다 — 화면이 DEB_01_008 안내에 주제를 보여 줘야 해서."""
    debate = db.get(Debate, debate_id)
    if debate is None:
        raise api_error(404, "not_found", "없는 토론이에요.")
    if debate.is_hidden:
        raise api_error(410, "hidden", "신고가 많아 가려진 토론이에요.")
    return debate
