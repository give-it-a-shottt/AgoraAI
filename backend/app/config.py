"""환경변수 설정. 값은 .env 또는 실제 환경변수에서 읽는다(비밀값을 코드에 두지 않는다)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"  # development | test | production
    database_url: str = "sqlite:///./agora.db"
    session_secret: str = "dev-only-change-me"
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

    # Q-001 · Q-002 임시값 (사용자 결정 전)
    daily_user_limit: int = 3
    daily_global_limit: int = 20

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
