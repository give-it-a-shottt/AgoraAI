"""실제 공급자 HTTP 호출 공통 처리: 시간 제한, 에러를 ProviderError로 통일, 응답 본문은 로그에 남기지 않음."""

import logging

import httpx

from app.providers.base import ProviderError

logger = logging.getLogger("agora.providers")

TIMEOUT = httpx.Timeout(40.0, connect=10.0)


def post_json(url: str, *, headers: dict, payload: dict, provider: str) -> dict:
    try:
        res = httpx.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        raise ProviderError(f"{provider} 연결 실패: {type(exc).__name__}") from exc
    if res.status_code != 200:
        # 키·본문 같은 민감할 수 있는 값은 남기지 않고 상태 코드만 기록한다.
        logger.warning("%s 응답 오류: HTTP %s", provider, res.status_code)
        raise ProviderError(f"{provider} HTTP {res.status_code}")
    try:
        return res.json()
    except ValueError as exc:
        raise ProviderError(f"{provider} 응답이 JSON이 아님") from exc
