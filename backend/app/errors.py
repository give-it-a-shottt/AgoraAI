"""API 에러 모양을 한곳에서 만든다: {"detail": {"code", "message", ...}}"""

from fastapi import HTTPException


def api_error(status: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message, **extra})
