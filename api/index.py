"""Vercel 파이썬 함수 진입점: backend/의 FastAPI 앱을 그대로 노출한다(/api/*, /share/* 가 여기로 온다)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.main import app  # noqa: E402,F401
