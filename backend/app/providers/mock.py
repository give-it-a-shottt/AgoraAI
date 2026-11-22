"""가짜 공급자(D-002): 키 없이 개발·테스트할 때 정해진 틀로 한국어 발언을 만든다. 같은 입력이면 같은 출력."""

import hashlib

from app.providers.base import JudgeResult, TopicCheck, Turn, UtteranceRequest, UtteranceResult

_OPENERS = {
    1: [
        "{catch} {mine}은(는) 고르는 순간부터 기분이 달라요. 하루를 시작할 때 떠올리기만 해도 웃음이 나잖아요. {theirs}은(는) 좋을 때만 좋고요.",
        "{catch} 사람들이 {mine}을(를) 찾는 데는 이유가 있어요. 한 번 맛 들이면 못 돌아가거든요. {theirs}은(는) 금방 질려요.",
    ],
    2: [
        "{theirs} 얘기 들어 보니 그럴듯하긴 해요. 근데 그건 처음 한두 번뿐이에요. 매일이라고 생각하면 {mine} 쪽이 훨씬 오래 버텨요.",
        "방금 그 말, 인정할 건 인정할게요. 그런데 핵심이 빠졌어요. {theirs}은(는) 결국 귀찮아지는 순간이 오고, {mine}은(는) 그때도 편해요.",
    ],
    3: [
        "정리하면 이래요. {theirs}은(는) 반짝이고, {mine}은(는) 꾸준해요. 평생 간다면 꾸준한 쪽이 이기는 거죠.",
        "결국 한 문장이에요. 오래 같이 갈 수 있는 건 {mine}이에요. {theirs}은(는) 추억으로 남기세요.",
    ],
}
_CAPTIONS = {1: "{mine}은 시작부터 다름", 2: "{theirs}은 금방 질림", 3: "결국 {mine}이 이김"}


def _pick(options: list[str], key: str) -> str:
    digest = int(hashlib.sha256(key.encode()).hexdigest(), 16)
    return options[digest % len(options)]


def _short(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


class MockDebater:
    def __init__(self, name: str):
        self.name = name

    def generate(self, req: UtteranceRequest) -> UtteranceResult:
        template = _pick(_OPENERS[req.round], f"{req.topic_a}|{req.topic_b}|{req.side}|{req.round}")
        catch = "근데 그거 아세요?" if "근데" in req.persona.catchphrase else "숫자로 따져 볼게요."
        text = template.format(catch=catch, mine=req.my_topic, theirs=req.opponent_topic)
        caption = _CAPTIONS[req.round].format(mine=_short(req.my_topic, 6), theirs=_short(req.opponent_topic, 6))
        return UtteranceResult(text=text, caption=caption)


class MockJudge:
    """심판(F-005 판정)·주제 검수(F-007)용 가짜."""

    name = "mock-judge"

    def judge(self, topic_a: str, topic_b: str, turns: list[Turn]) -> JudgeResult:
        winner = "A" if int(hashlib.sha256(f"{topic_a}|{topic_b}".encode()).hexdigest(), 16) % 2 == 0 else "B"
        # 2번째 발언(1R B)은 자기 주장 위주라 neutral, 그다음부터는 반박.
        stances = ["neutral" if i == 0 else "rebut" for i in range(len(turns) - 1)]
        topic = topic_a if winner == "A" else topic_b
        return JudgeResult(winner=winner, reason=f"{topic} 편이 생활 장면을 더 구체적으로 보여 줬어요.", stances=stances)

    def check_topic(self, topic_a: str, topic_b: str) -> TopicCheck:
        return TopicCheck(allowed=True)
