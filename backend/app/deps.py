"""라우터 공통 의존성: DB 세션, 토론 ID 경로 값, 브라우저 번호(X-Browser-Id)."""

import uuid
from typing import Annotated

from fastapi import Cookie, Depends, Header, Path, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import api_error
from app.models import Debate, User
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
    return client_hash(client_ip(request, settings.trust_proxy), settings.session_secret)


def client_ip(request: Request, trust_proxy: bool) -> str:
    """접속 주소. 앞단 프록시를 믿을 때만 헤더를 본다.
    - x-vercel-forwarded-for / x-real-ip: Vercel이 직접 넣는 값(요청자가 바꿀 수 없음)
    - X-Forwarded-For는 요청자가 앞부분을 끼워 넣을 수 있어, 프록시가 마지막에 붙인 맨 오른쪽 값만 쓴다."""
    direct = request.client.host if request.client else "unknown"
    if not trust_proxy:
        return direct
    for header in ("x-vercel-forwarded-for", "x-real-ip"):
        value = request.headers.get(header, "").split(",")[0].strip()
        if value:
            return value
    forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    return forwarded[-1] if forwarded else direct


ClientKey = Annotated[str, Depends(client_key)]


def load_debate(db: Session, debate_id: str) -> Debate:
    """없으면 404. 가려진 토론도 돌려준다(공유 주소처럼 '이동은 시키는' 곳에서 쓴다)."""
    debate = db.get(Debate, debate_id)
    if debate is None:
        raise api_error(404, "not_found", "없는 토론이에요.")
    return debate


def load_visible_debate(db: Session, debate_id: str) -> Debate:
    """발언·예측·공감·신고처럼 토론 '안'을 다루는 API용: 없으면 404, 가려졌으면 410.
    상세(GET /api/debates/{id})만 예외로 200 + hidden=true를 준다 — 화면이 DEB_01_008 안내에 주제를 보여 줘야 해서."""
    debate = load_debate(db, debate_id)
    if debate.is_hidden:
        raise api_error(410, "hidden", "신고가 많아 가려진 토론이에요.")
    return debate


def current_user(db: DB, agora_session: Annotated[str | None, Cookie()] = None) -> User | None:
    """서명된 세션 쿠키로 로그인한 사용자(없으면 None). 쿠키는 HttpOnly라 자바스크립트가 못 읽는다(D-004)."""
    from app.services import (
        auth,  # services.auth가 models·config를 읽고, deps는 라우터 공용이라 순환을 피해 여기서
    )

    session = auth.read_session(get_settings(), agora_session)
    if session is None:
        return None
    uid, version = session
    user = db.get(User, uid)
    return user if user is not None and user.session_version == version else None


CurrentUser = Annotated[User | None, Depends(current_user)]


def require_user(user: CurrentUser) -> User:
    if user is None:
        raise api_error(401, "login_required", "로그인하고 토론을 만들 수 있어요.")
    return user


LoggedInUser = Annotated[User, Depends(require_user)]
