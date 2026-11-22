"""공급자 고르기(D-002): 키가 있으면 진짜, 없으면 mock. 토론자 A=냥냥이(HyperCLOVA X), B=펭펭이(Gemini) 고정."""

import logging

from app.config import get_settings
from app.providers.base import Debater, Judge
from app.providers.mock import MockDebater, MockJudge
from app.providers.real import GeminiDebater, GroqJudge, HyperClovaDebater

logger = logging.getLogger("agora.providers")

# 시드처럼 비용을 쓰면 안 되는 작업은 키가 있어도 mock을 쓰게 강제한다(Q-007).
_force_mock = False


def force_mock(enabled: bool) -> None:
    global _force_mock
    _force_mock = enabled


def _warn_mock(what: str) -> None:
    if get_settings().is_production:
        logger.warning("운영 환경인데 %s 키가 없어 mock 공급자를 씁니다.", what)


def debater_for(character: str) -> Debater:
    s = get_settings()
    if _force_mock:
        return MockDebater(f"mock-{character}")
    if character == "cat":
        if s.hyperclova_api_key:
            return HyperClovaDebater(s.hyperclova_api_key, s.hyperclova_model)
        _warn_mock("HYPERCLOVA_API_KEY")
        return MockDebater("mock-hyperclova")
    if s.gemini_api_key:
        return GeminiDebater(s.gemini_api_key, s.gemini_model)
    _warn_mock("GEMINI_API_KEY")
    return MockDebater("mock-gemini")


def judge() -> Judge:
    """심판 공급자(F-005 판정·F-007 주제 검수에서 사용)."""
    s = get_settings()
    if _force_mock:
        return MockJudge()
    if s.groq_api_key:
        return GroqJudge(s.groq_api_key, s.groq_model)
    _warn_mock("GROQ_API_KEY")
    return MockJudge()
