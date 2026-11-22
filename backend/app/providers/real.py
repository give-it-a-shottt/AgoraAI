"""실제 공급자: 토론자 A = HyperCLOVA X, 토론자 B = Gemini, 심판 = Groq(gpt-oss). 키는 환경변수에서만 읽는다."""

from app.providers import prompts
from app.providers.base import (
    JudgeResult,
    ProviderError,
    TopicCheck,
    Turn,
    UtteranceRequest,
    UtteranceResult,
)
from app.providers.http import post_json

VALID_STANCES = {"rebut", "agree", "neutral"}


def _utterance_from(raw: str, provider: str) -> UtteranceResult:
    try:
        data = prompts.parse_json_object(raw)
        text, caption = str(data["text"]).strip(), str(data["caption"]).strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise ProviderError(f"{provider} 발언 형식 오류") from exc
    if not text or not caption:
        raise ProviderError(f"{provider} 빈 발언")
    return UtteranceResult(text=text, caption=caption)


class HyperClovaDebater:
    """CLOVA Studio Chat Completions v3."""

    name = "HyperCLOVA X"

    def __init__(self, api_key: str, model: str):
        self._key, self._model = api_key, model

    def generate(self, req: UtteranceRequest) -> UtteranceResult:
        system, user = prompts.debater_messages(req)
        data = post_json(
            f"https://clovastudio.stream.ntruss.com/v3/chat-completions/{self._model}",
            headers={"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"},
            payload={
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "maxTokens": 400,
                "temperature": 0.8,
                "topP": 0.9,
            },
            provider=self.name,
        )
        try:
            content = data["result"]["message"]["content"]
        except (KeyError, TypeError) as exc:
            raise ProviderError("HyperCLOVA X 응답 구조 오류") from exc
        return _utterance_from(content, self.name)


class GeminiDebater:
    """Google Gemini generateContent (JSON 응답 모드)."""

    name = "Gemini"

    def __init__(self, api_key: str, model: str):
        self._key, self._model = api_key, model

    def generate(self, req: UtteranceRequest) -> UtteranceResult:
        system, user = prompts.debater_messages(req)
        data = post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent",
            headers={"x-goog-api-key": self._key, "Content-Type": "application/json"},
            payload={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {
                    "temperature": 0.8,
                    "maxOutputTokens": 400,
                    "responseMimeType": "application/json",
                },
            },
            provider=self.name,
        )
        try:
            content = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("Gemini 응답 구조 오류") from exc
        return _utterance_from(content, self.name)


class GroqJudge:
    """Groq OpenAI 호환 Chat Completions — 심판 판정과 주제 검수."""

    name = "Groq gpt-oss"

    def __init__(self, api_key: str, model: str):
        self._key, self._model = api_key, model

    def _chat(self, system: str, user: str) -> dict:
        data = post_json(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"},
            payload={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            provider=self.name,
        )
        try:
            return prompts.parse_json_object(data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError("Groq 응답 형식 오류") from exc

    def judge(self, topic_a: str, topic_b: str, turns: list[Turn]) -> JudgeResult:
        data = self._chat(*prompts.judge_messages(topic_a, topic_b, turns))
        winner = data.get("winner")
        stances = data.get("stances")
        expected = len(turns) - 1
        if winner not in ("A", "B") or not isinstance(stances, list):
            raise ProviderError("Groq 판정 형식 오류")
        # 개수가 다르면 앞에서부터 맞추고 모자라면 neutral로 채운다(지표가 비지 않게).
        clean = [s if s in VALID_STANCES else "neutral" for s in stances][:expected]
        clean += ["neutral"] * (expected - len(clean))
        return JudgeResult(winner=winner, reason=str(data.get("reason", ""))[:200], stances=clean)

    def check_topic(self, topic_a: str, topic_b: str) -> TopicCheck:
        data = self._chat(*prompts.topic_check_messages(topic_a, topic_b))
        allowed = data.get("allowed")
        if not isinstance(allowed, bool):
            raise ProviderError("Groq 검수 형식 오류")
        return TopicCheck(allowed=allowed, reason=str(data.get("reason", ""))[:100])
