# Agora AI 토론장

밸런스 게임 주제를 AI 캐릭터 둘이 한국어로 토론하고, 발언의 핵심이 예능 자막처럼 뜨는 AI 토론장 (비상업 포트폴리오).

## 구조
- `frontend/` Vite + React + TypeScript
- `backend/` FastAPI + SQLAlchemy + Alembic
- `Admin_Docs/` 설계·결정·기능·리뷰 문서 (시작: `Admin_Docs/START_HERE.md`)
- `agora-design.md` 기획·디자인 확정본

## 로컬 실행
```bash
# 백엔드 (http://localhost:8000)
cd backend
cp .env.example .env        # 키가 없으면 비워 두면 mock AI로 동작
uv sync
uv run alembic upgrade head
uv run python -m app.jobs.seed   # 시드 토론 넣기
uv run uvicorn app.main:app --reload

# 프론트 (http://localhost:5173, /api는 8000으로 프록시)
cd frontend
npm install
npm run dev
```

## 테스트
```bash
cd backend && uv run pytest
cd frontend && npm test && npm run lint && npm run build
```
⚠️ Windows에서는 드라이브 글자를 대문자로(`cd C:/project/AgoraAI/frontend`) 해서 `npm test`를 실행하세요. 소문자 `c:`면 Vitest가 실패합니다(Admin_Docs/troubleshooting/T-001).

## 환경변수 (이름만, 값은 .env에)
`APP_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, `PUBLIC_BASE_URL`, `HYPERCLOVA_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_REST_KEY`, `KAKAO_CLIENT_SECRET`, `CRON_SECRET`, `TRUST_PROXY`, 프론트 `VITE_KAKAO_JS_KEY`·`VITE_GITHUB_URL`, `DAILY_USER_LIMIT`, `DAILY_GLOBAL_LIMIT`, `DAILY_USER_CHECKS`, `DAILY_GLOBAL_CHECKS`

배포 절차는 [DEPLOY.md](DEPLOY.md)를 보세요.
