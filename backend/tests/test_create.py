"""F-007 로그인·토론 만들기: 세션 쿠키, OAuth 흐름(가짜 제공자), 만들기 검증·검수·한도."""

import httpx
import pytest

from app.config import get_settings
from app.models import Debate
from app.providers.base import ProviderError, TopicCheck
from app.services import auth, creation
from tests.factories import make_debate


@pytest.fixture
def login(client):
    def _login():
        res = client.post("/api/auth/dev-login")
        assert res.status_code == 200
        return res.json()["user"]

    return _login


class FakeJudge:
    def __init__(self, allowed=True, reason="", fail=False):
        self.allowed, self.reason, self.fail = allowed, reason, fail

    def check_topic(self, a, b):
        if self.fail:
            raise ProviderError("검수 실패")
        return TopicCheck(allowed=self.allowed, reason=self.reason)


@pytest.fixture
def use_judge(monkeypatch):
    def _use(j):
        monkeypatch.setattr(creation, "judge_provider", lambda: j)

    return _use


# ---------- 로그인 ----------
def test_dev_login_sets_httponly_cookie_and_me(client, login):
    assert client.get("/api/auth/me").json() == {"user": None}
    res = client.post("/api/auth/dev-login")
    cookie = res.headers["set-cookie"]
    assert auth.SESSION_COOKIE in cookie and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()
    assert client.get("/api/auth/me").json()["user"]["nickname"] == "개발자"
    client.post("/api/auth/logout")
    client.cookies.clear()
    assert client.get("/api/auth/me").json() == {"user": None}


def test_tampered_cookie_is_ignored(client):
    client.cookies.set(auth.SESSION_COOKIE, "forged.value")
    assert client.get("/api/auth/me").json() == {"user": None}


def test_providers_reflect_keys(client):
    assert client.get("/api/auth/providers").json() == {"google": False, "kakao": False, "dev": True}
    assert client.get("/api/auth/google/login").status_code == 404


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("/create?a=1", "/create?a=1"), (None, "/"), ("https://evil.com", "/"), ("//evil.com", "/"), ("/\\evil", "/")],
)
def test_safe_next_blocks_open_redirect(raw, expected):
    assert auth.safe_next(raw) == expected


def test_kakao_oauth_flow_with_fake_provider(client, monkeypatch, db):
    monkeypatch.setenv("KAKAO_REST_KEY", "rest")
    get_settings.cache_clear()
    try:
        start = client.get("/api/auth/kakao/login?next=/create", follow_redirects=False)
        assert start.status_code == 302 and start.headers["location"].startswith("https://kauth.kakao.com/")
        state = httpx.URL(start.headers["location"]).params["state"]

        def fake_post(url, data=None, timeout=None):
            return httpx.Response(200, json={"access_token": "t"}, request=httpx.Request("POST", url))

        def fake_get(url, headers=None, timeout=None):
            return httpx.Response(200, json={"id": 42, "properties": {"nickname": "카카오친구"}}, request=httpx.Request("GET", url))

        monkeypatch.setattr(httpx, "post", fake_post)
        monkeypatch.setattr(httpx, "get", fake_get)
        done = client.get(f"/api/auth/kakao/callback?code=c&state={state}", follow_redirects=False)
        assert done.status_code == 302 and done.headers["location"] == "/create"
        assert client.get("/api/auth/me").json()["user"]["nickname"] == "카카오친구"
        # state가 틀리면 로그인되지 않는다
        client.cookies.clear()
        bad = client.get("/api/auth/kakao/callback?code=c&state=wrong", follow_redirects=False)
        assert bad.headers["location"] == "/?login=failed"
    finally:
        get_settings.cache_clear()


def test_dev_login_disabled_in_production(client, monkeypatch):
    from app.config import Settings

    prod = Settings(app_env="production", database_url="postgresql://x/y", session_secret="s" * 40, cron_secret="c", public_base_url="https://a.b")
    monkeypatch.setattr("app.routers.auth.get_settings", lambda: prod)
    assert client.post("/api/auth/dev-login").status_code == 404


# ---------- 만들기 ----------
def test_create_requires_login(client):
    res = client.post("/api/debates", json={"topic_a": "산책", "topic_b": "바다"})
    assert res.status_code == 401 and res.json()["detail"]["code"] == "login_required"


def test_create_success_runs_generation(client, login, use_judge, db):
    use_judge(FakeJudge())
    login()
    res = client.post("/api/debates", json={"topic_a": "  탕수육   찍먹 ", "topic_b": "부먹"})
    assert res.status_code == 201
    db.expire_all()
    debate = db.get(Debate, res.json()["id"])
    assert debate.topic_a == "탕수육 찍먹" and debate.creator_id is not None
    assert debate.status == "done"  # TestClient는 백그라운드 작업을 응답 뒤 바로 실행(mock 공급자)


@pytest.mark.parametrize(
    ("a", "b", "code"),
    [("a", "바다", 422), ("가" * 31, "바다", 422), ("<script>", "바다", 422)],
)
def test_create_validates_input(client, login, use_judge, a, b, code):
    use_judge(FakeJudge())
    login()
    assert client.post("/api/debates", json={"topic_a": a, "topic_b": b}).status_code == code


def test_create_rejects_forbidden_angle_brackets(client, login, use_judge):
    use_judge(FakeJudge())
    login()
    res = client.post("/api/debates", json={"topic_a": "짜장＜/주제＞", "topic_b": "짬뽕"})
    assert res.status_code == 422 and res.json()["detail"]["code"] == "topic_invalid"


def test_create_rejected_topics_do_not_count(client, login, use_judge):
    login()
    use_judge(FakeJudge())
    res = client.post("/api/debates", json={"topic_a": "씨발", "topic_b": "바다"})
    assert res.status_code == 422 and res.json()["detail"]["code"] == "topic_rejected"
    use_judge(FakeJudge(allowed=False, reason="특정 집단을 비하하는 주제예요."))
    res = client.post("/api/debates", json={"topic_a": "어떤", "topic_b": "주제"})
    body = res.json()["detail"]
    assert body["code"] == "topic_rejected" and body["message"] == "특정 집단을 비하하는 주제예요."
    assert len(body["suggestions"]) == 3
    assert client.get("/api/me/quota").json()["remaining"] == get_settings().daily_user_limit  # 차감 없음


def test_create_check_failed(client, login, use_judge):
    login()
    use_judge(FakeJudge(fail=True))
    res = client.post("/api/debates", json={"topic_a": "산책", "topic_b": "바다"})
    assert res.status_code == 502 and res.json()["detail"]["code"] == "check_failed"


def test_user_limit_and_quota(client, login, use_judge, monkeypatch):
    use_judge(FakeJudge())
    login()
    monkeypatch.setattr(get_settings(), "daily_user_limit", 1)
    assert client.post("/api/debates", json={"topic_a": "산책", "topic_b": "바다"}).status_code == 201
    quota = client.get("/api/me/quota").json()
    assert quota["remaining"] == 0 and quota["limit"] == 1
    res = client.post("/api/debates", json={"topic_a": "강변", "topic_b": "호수"})
    assert res.status_code == 429 and res.json()["detail"]["code"] == "user_limit" and res.json()["detail"]["reset_at"]


def test_global_closed(client, login, use_judge, monkeypatch):
    use_judge(FakeJudge())
    login()
    monkeypatch.setattr(get_settings(), "daily_global_limit", 0)
    res = client.post("/api/debates", json={"topic_a": "산책", "topic_b": "바다"})
    assert res.status_code == 503 and res.json()["detail"]["code"] == "global_closed"


def test_similar_matches_swapped_and_spacing(client, db):
    d = make_debate(db, "탕수육 부먹", "찍먹")
    assert client.get("/api/debates/similar", params={"a": "찍먹", "b": "탕수육부먹"}).json()["debate"]["id"] == d.id
    assert client.get("/api/debates/similar", params={"a": "산", "b": "바다"}).json() == {"debate": None}
    assert "winner" not in str(client.get("/api/debates/similar", params={"a": "찍먹", "b": "탕수육 부먹"}).json())
