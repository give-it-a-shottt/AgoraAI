"""로그인 API(F-007, COM_01_001). 토론 만들기만 로그인이 필요하다(D-004)."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Query, Response
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.deps import DB, CurrentUser
from app.errors import api_error
from app.schemas import MeOut, ProvidersOut, UserOut
from app.services import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session(response: Response, user_id: int) -> None:
    s = get_settings()
    response.set_cookie(
        auth.SESSION_COOKIE,
        auth.make_session(s, user_id),
        max_age=auth.SESSION_MAX_AGE,
        httponly=True,
        secure=s.is_production,
        samesite="lax",
        path="/",
    )


@router.get("/providers", response_model=ProvidersOut)
def providers() -> ProvidersOut:
    return ProvidersOut(**auth.configured(get_settings()))


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return MeOut(user=UserOut(id=user.id, nickname=user.nickname) if user else None)


@router.get("/{provider}/login")
def login(provider: str, next: Annotated[str | None, Query(max_length=512)] = None) -> RedirectResponse:
    s = get_settings()
    p = auth.PROVIDERS.get(provider)
    if p is None or not auth.configured(s)[provider]:
        raise api_error(404, "provider_unavailable", "지금은 이 방법으로 로그인할 수 없어요.")
    url, state_cookie = auth.start_login(s, p, next or "/")
    res = RedirectResponse(url, status_code=302)
    res.set_cookie(auth.STATE_COOKIE, state_cookie, max_age=auth.STATE_MAX_AGE, httponly=True, secure=s.is_production, samesite="lax", path="/api/auth")
    return res


@router.get("/{provider}/callback")
def callback(
    provider: str,
    db: DB,
    code: Annotated[str | None, Query(max_length=2048)] = None,
    state: Annotated[str | None, Query(max_length=256)] = None,
    agora_oauth_state: Annotated[str | None, Cookie()] = None,
) -> RedirectResponse:
    s = get_settings()
    p = auth.PROVIDERS.get(provider)
    if p is None or not auth.configured(s)[provider]:
        raise api_error(404, "provider_unavailable", "지금은 이 방법으로 로그인할 수 없어요.")
    try:
        next_path = auth.check_state(s, p, agora_oauth_state, state)
        if not code:
            raise auth.AuthError("code")  # 사용자가 동의를 취소한 경우 등
        uid, nickname = auth.fetch_profile(s, p, code)
    except auth.AuthError:
        res = RedirectResponse("/?login=failed", status_code=302)
        res.delete_cookie(auth.STATE_COOKIE, path="/api/auth")
        return res
    user = auth.upsert_user(db, p.name, uid, nickname)
    res = RedirectResponse(next_path, status_code=302)
    res.delete_cookie(auth.STATE_COOKIE, path="/api/auth")
    _set_session(res, user.id)
    return res


@router.post("/dev-login", response_model=MeOut)
def dev_login(db: DB, response: Response) -> MeOut:
    """키 없이 로컬에서 만들기를 써 볼 수 있게. 운영에서는 없는 주소(404)."""
    if get_settings().is_production:
        raise api_error(404, "not_found", "찾는 주소가 없어요.")
    user = auth.upsert_user(db, "dev", "local-developer", "개발자")
    _set_session(response, user.id)
    return MeOut(user=UserOut(id=user.id, nickname=user.nickname))


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(auth.SESSION_COOKIE, path="/")
    return {"ok": True}
