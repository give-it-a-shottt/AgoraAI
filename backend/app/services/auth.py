"""로그인(D-004): 구글·카카오 OAuth → 서명된 세션 쿠키. 키가 없으면(운영 아님) 개발용 로그인.
세션 쿠키에는 사용자 번호만 담고 HttpOnly로 둔다(자바스크립트에서 못 읽게). 이메일 등 연락처는 받지 않는다.
"""

import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import User

SESSION_COOKIE = "agora_session"
STATE_COOKIE = "agora_oauth_state"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30일
STATE_MAX_AGE = 60 * 10  # 로그인 창은 10분 안에 끝내야 한다
TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class AuthError(Exception):
    pass


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str
    profile_url: str
    scope: str


GOOGLE = Provider(
    "google",
    "https://accounts.google.com/o/oauth2/v2/auth",
    "https://oauth2.googleapis.com/token",
    "https://openidconnect.googleapis.com/v1/userinfo",
    "openid profile",
)
KAKAO = Provider(
    "kakao",
    "https://kauth.kakao.com/oauth/authorize",
    "https://kauth.kakao.com/oauth/token",
    "https://kapi.kakao.com/v2/user/me",
    "profile_nickname",
)
PROVIDERS = {"google": GOOGLE, "kakao": KAKAO}


def _serializer(settings: Settings, salt: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt=salt)


def configured(settings: Settings) -> dict[str, bool]:
    return {
        "google": bool(settings.google_client_id and settings.google_client_secret),
        "kakao": bool(settings.kakao_rest_key),
        "dev": not settings.is_production,
    }


def safe_next(path: str | None) -> str:
    """로그인 뒤 돌아갈 곳은 우리 사이트 안 경로만(다른 사이트로 보내는 오픈 리다이렉트 방지)."""
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path:
        return "/"
    return path


# ---------- 세션 ----------
def make_session(settings: Settings, user_id: int) -> str:
    return _serializer(settings, "session").dumps({"uid": user_id})


def read_session(settings: Settings, token: str | None) -> int | None:
    if not token:
        return None
    try:
        data = _serializer(settings, "session").loads(token, max_age=SESSION_MAX_AGE)
    except BadSignature:
        return None
    uid = data.get("uid") if isinstance(data, dict) else None
    return uid if isinstance(uid, int) else None


# ---------- OAuth ----------
def _redirect_uri(settings: Settings, provider: Provider) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/auth/{provider.name}/callback"


def start_login(settings: Settings, provider: Provider, next_path: str) -> tuple[str, str]:
    """(제공자 로그인 주소, state 쿠키 값). state는 서명해서 쿠키에 두고 콜백에서 맞춰 본다(CSRF 방지)."""
    nonce = secrets.token_urlsafe(16)
    state_cookie = _serializer(settings, "oauth-state").dumps({"n": nonce, "next": safe_next(next_path), "p": provider.name})
    client_id = settings.google_client_id if provider is GOOGLE else settings.kakao_rest_key
    query = {
        "client_id": client_id,
        "redirect_uri": _redirect_uri(settings, provider),
        "response_type": "code",
        "scope": provider.scope,
        "state": nonce,
    }
    return f"{provider.authorize_url}?{urlencode(query)}", state_cookie


def check_state(settings: Settings, provider: Provider, cookie: str | None, state: str | None) -> str:
    """콜백의 state가 쿠키와 맞으면 돌아갈 경로를 돌려준다."""
    try:
        data = _serializer(settings, "oauth-state").loads(cookie or "", max_age=STATE_MAX_AGE)
    except BadSignature as exc:
        raise AuthError("state") from exc
    if not state or not secrets.compare_digest(str(data.get("n", "")), state) or data.get("p") != provider.name:
        raise AuthError("state")
    return safe_next(data.get("next"))


def fetch_profile(settings: Settings, provider: Provider, code: str) -> tuple[str, str]:
    """인가 코드 → (제공자 사용자 번호, 닉네임). 이메일은 요청하지도 저장하지도 않는다."""
    if provider is GOOGLE:
        form = {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": _redirect_uri(settings, provider),
            "grant_type": "authorization_code",
        }
    else:
        form = {
            "code": code,
            "client_id": settings.kakao_rest_key,
            "redirect_uri": _redirect_uri(settings, provider),
            "grant_type": "authorization_code",
        }
        if settings.kakao_client_secret:
            form["client_secret"] = settings.kakao_client_secret
    try:
        token_res = httpx.post(provider.token_url, data=form, timeout=TIMEOUT)
        token_res.raise_for_status()
        access = token_res.json()["access_token"]
        profile_res = httpx.get(provider.profile_url, headers={"Authorization": f"Bearer {access}"}, timeout=TIMEOUT)
        profile_res.raise_for_status()
        profile = profile_res.json()
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise AuthError("provider") from exc
    if provider is GOOGLE:
        uid, nickname = profile.get("sub"), profile.get("name") or "구글 사용자"
    else:
        uid = profile.get("id")
        nickname = (profile.get("properties") or {}).get("nickname") or "카카오 사용자"
    if not uid:
        raise AuthError("profile")
    return str(uid), str(nickname)[:64]


def upsert_user(db: Session, provider: str, provider_user_id: str, nickname: str) -> User:
    user = db.scalar(select(User).where(User.provider == provider, User.provider_user_id == provider_user_id))
    if user is None:
        user = User(provider=provider, provider_user_id=provider_user_id, nickname=nickname)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:  # 동시에 처음 로그인
            db.rollback()
            user = db.scalar(select(User).where(User.provider == provider, User.provider_user_id == provider_user_id))
    return user
