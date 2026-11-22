"""환경변수 설정. 값은 .env 또는 실제 환경변수에서 읽는다(비밀값을 코드에 두지 않는다)."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SESSION_SECRET = "dev-only-change-me"
MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    # 빈 값(.env.example 복사 직후)은 "없음"으로 보고 기본값을 쓴다.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", env_ignore_empty=True
    )

    app_env: str = "development"  # development | test | production
    database_url: str = "sqlite:///./agora.db"
    session_secret: str = DEV_SESSION_SECRET
    frontend_origin: str = "http://localhost:5173"
    public_base_url: str = "http://localhost:5173"

    hyperclova_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    groq_model: str = "openai/gpt-oss-120b"
    hyperclova_model: str = "HCX-005"

    google_client_id: str = ""
    google_client_secret: str = ""
    kakao_rest_key: str = ""
    kakao_client_secret: str = ""

    cron_secret: str = ""
    # 앞단 프록시(Vercel)가 붙여 주는 X-Forwarded-For를 믿을지. 직접 노출된 서버에서는 위조될 수 있어 기본 False.
    trust_proxy: bool = False

    # Q-001 · Q-002 임시값 (사용자 결정 전)
    daily_user_limit: int = 3
    daily_global_limit: int = 20

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        """운영에서 비밀값이 비었거나 개발용이면 서버를 띄우지 않는다(쿠키 위조·cron 무단 호출 방지)."""
        if not self.is_production:
            return self
        problems = []
        if self.session_secret == DEV_SESSION_SECRET or len(self.session_secret) < MIN_SECRET_LENGTH:
            problems.append(f"SESSION_SECRET(개발용이 아닌 {MIN_SECRET_LENGTH}자 이상)")
        if not self.cron_secret:
            problems.append("CRON_SECRET")
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL(Postgres)")
        if not self.public_base_url.startswith("https://"):
            problems.append("PUBLIC_BASE_URL(https 배포 주소 — 공유 미리보기·로그인 콜백에 씀)")
        if problems:
            raise ValueError("운영 환경 설정이 빠졌어요: " + ", ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
