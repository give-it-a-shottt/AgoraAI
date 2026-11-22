"""AI 공급자 공통 인터페이스. 진짜(HyperCLOVA X·Gemini·Groq)와 가짜(mock)가 같은 모양을 따른다(D-002)."""

from dataclasses import dataclass, field
from typing import Literal, Protocol

Side = Literal["A", "B"]
Stance = Literal["rebut", "agree", "neutral"]


class ProviderError(Exception):
    """공급자 호출 실패(네트워크·한도·형식 오류). 생성 엔진이 실패 횟수로 센다."""


@dataclass(frozen=True)
class Persona:
    name: str
    catchphrase: str


@dataclass(frozen=True)
class Turn:
    side: Side
    speaker: str
    text: str


@dataclass(frozen=True)
class UtteranceRequest:
    topic_a: str
    topic_b: str
    side: Side
    round: int  # 1 주장 · 2 반박 · 3 마무리
    persona: Persona
    opponent: Persona
    history: list[Turn] = field(default_factory=list)

    @property
    def my_topic(self) -> str:
        return self.topic_a if self.side == "A" else self.topic_b

    @property
    def opponent_topic(self) -> str:
        return self.topic_b if self.side == "A" else self.topic_a


@dataclass(frozen=True)
class UtteranceResult:
    text: str
    caption: str


@dataclass(frozen=True)
class JudgeResult:
    winner: Side
    reason: str
    stances: list[Stance]  # 2번째 발언부터 순서대로(직전 상대 발언에 대한 태도)


@dataclass(frozen=True)
class TopicCheck:
    allowed: bool
    reason: str = ""


class Debater(Protocol):
    name: str

    def generate(self, req: UtteranceRequest) -> UtteranceResult: ...


class Judge(Protocol):
    name: str

    def judge(self, topic_a: str, topic_b: str, turns: list[Turn]) -> JudgeResult: ...

    def check_topic(self, topic_a: str, topic_b: str) -> TopicCheck: ...
