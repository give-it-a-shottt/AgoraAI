"""공급자 고르기(D-002·D-005): 키가 있으면 진짜, 없으면 mock.
냥냥이 = HyperCLOVA X → EXAONE(키 1·2) → Groq Qwen 순서로 앞이 막히면 다음으로, 펭펭이 = Gemini, 심판 = Groq gpt-oss."""

import logging

from app.config import Settings, get_settings
from app.providers.base import Debater, Judge
from app.providers.mock import MockDebater, MockJudge
from app.providers.real import (
    FallbackDebater,
    GeminiDebater,
    GroqJudge,
    HyperClovaDebater,
    OpenAICompatDebater,
)

logger = logging.getLogger("agora.providers")

EXAONE_URL = "https://api.exaone.ai/v1/chat/completions"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# 시드처럼 비용을 쓰면 안 되는 작업은 키가 있어도 mock을 쓰게 강제한다(Q-007).
_force_mock = False


def force_mock(enabled: bool) -> None:
    global _force_mock
    _force_mock = enabled


def _warn_mock(what: str) -> None:
    if get_settings().is_production:
        logger.warning("운영 환경인데 %s 키가 없어 mock 공급자를 씁니다.", what)


def _cat_chain(s: Settings) -> list[Debater]:
    chain: list[Debater] = []
    if s.hyperclova_api_key:
        chain.append(HyperClovaDebater(s.hyperclova_api_key, s.hyperclova_model))
    for key in (s.exaone_api_key, s.exaone_api_key_2):
        if key:
            chain.append(
                OpenAICompatDebater(
                    "EXAONE", EXAONE_URL, key, s.exaone_model,
                    max_tokens=1500,  # 생각 토큰도 여기서 쓰므로 넉넉히
                    extra={"reasoning_effort": s.exaone_reasoning_effort},
                )
            )
    if s.groq_api_key and s.groq_cat_model:
        chain.append(OpenAICompatDebater("Qwen", GROQ_URL, s.groq_api_key, s.groq_cat_model))
    return chain


def debater_for(character: str) -> Debater:
    s = get_settings()
    if _force_mock:
        return MockDebater(f"mock-{character}")
    if character == "cat":
        chain = _cat_chain(s)
        if not chain:
            _warn_mock("HYPERCLOVA_API_KEY·EXAONE_API_KEY·GROQ_API_KEY")
            return MockDebater("mock-cat")
        return chain[0] if len(chain) == 1 else FallbackDebater(chain)
    if s.gemini_api_key:
        return GeminiDebater(s.gemini_api_key, s.gemini_model)
    _warn_mock("GEMINI_API_KEY")
    return MockDebater("mock-gemini")


def ai_label(character: str, default: str) -> str:
    """화면의 "냥냥이 · ○○"에 쓸 AI 이름 — 지금 1순위로 쓰는 공급자. 키가 없으면(mock) 기본 이름."""
    if character == "cat":
        chain = _cat_chain(get_settings())
        return chain[0].name if chain else default
    return default


def judge() -> Judge:
    """심판 공급자(F-005 판정·F-007 주제 검수에서 사용)."""
    s = get_settings()
    if _force_mock:
        return MockJudge()
    if s.groq_api_key:
        return GroqJudge(s.groq_api_key, s.groq_model)
    _warn_mock("GROQ_API_KEY")
    return MockJudge()
