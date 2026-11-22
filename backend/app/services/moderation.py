"""주제 검수·발언 출력 검사(P4). AI 검수 전에 빠르게 거르는 금지어 목록과, AI가 만든 발언의 길이·금지어 검사."""

import re

from app.providers.base import TopicCheck, UtteranceResult

MAX_TEXT = 300  # 무대 발언 최대 길이(§1 Density: 발언 300자)
MAX_CAPTION = 20  # 자막 박스 한 줄

# 노골적인 욕설·혐오·성·폭력·자해 표현. 띄어쓰기를 지우고 비교한다.
_BANNED = [
    "씨발", "시발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "개새끼", "니애미", "느금",
    "한남충", "한녀", "김치녀", "틀딱", "짱깨", "쪽바리", "흑형", "급식충", "맘충",
    "섹스", "야동", "강간", "성폭행", "몰카",
    "자살", "자해", "살인", "테러", "폭탄제조", "마약",
]
_BANNED_RE = re.compile("|".join(map(re.escape, _BANNED)))
_SPACES = re.compile(r"\s+")


class OutputRejected(Exception):
    """AI 발언이 출력 검사를 통과하지 못함(생성 엔진이 한 번 더 시도)."""


def contains_banned(text: str) -> bool:
    return bool(_BANNED_RE.search(_SPACES.sub("", text)))


def check_topic_local(topic_a: str, topic_b: str) -> TopicCheck:
    if contains_banned(topic_a) or contains_banned(topic_b):
        return TopicCheck(allowed=False, reason="토론하기 어려운 표현이 들어 있어요.")
    if _SPACES.sub("", topic_a).lower() == _SPACES.sub("", topic_b).lower():
        return TopicCheck(allowed=False, reason="A와 B가 같은 선택지예요.")
    return TopicCheck(allowed=True)


def _cut(text: str, limit: int) -> str:
    """길면 문장 끝(. ! ? 요) 기준으로 자르고, 그래도 길면 글자 수로 자른다."""
    if len(text) <= limit:
        return text
    head = text[:limit]
    ends = [head.rfind(mark) for mark in (". ", "! ", "? ", "요.", "요 ")]
    cut_at = max(ends)
    return head[: cut_at + 2].strip() if cut_at > limit // 2 else head.rstrip() + "…"


def check_output(result: UtteranceResult) -> UtteranceResult:
    text = _SPACES.sub(" ", result.text).strip()
    caption = _SPACES.sub(" ", result.caption).strip().strip("\"'“”").rstrip(".")
    if not text or not caption:
        raise OutputRejected("빈 발언")
    if contains_banned(text) or contains_banned(caption):
        raise OutputRejected("금지어")
    return UtteranceResult(text=_cut(text, MAX_TEXT), caption=caption[:MAX_CAPTION])
