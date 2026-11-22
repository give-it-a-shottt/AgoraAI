"""주제 정규화: 띄어쓰기·대소문자·A/B 순서가 달라도 같은 주제로 본다(CRT_01_001 "순서만 바뀐 것도 같은 주제")."""

import re

_SPACES = re.compile(r"\s+")


def normalize_topic(text: str) -> str:
    return _SPACES.sub("", text).lower()


def normalized_key(a: str, b: str) -> str:
    left, right = sorted((normalize_topic(a), normalize_topic(b)))
    return f"{left}|{right}"
