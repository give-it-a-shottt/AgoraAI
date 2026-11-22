# 전체 구조

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 브라우저 화면(frontend) → 서버 API(backend) → DB 순서로 흐른다. AI 발언은 서버가 만들어 DB에 쌓고, 화면은 DB에 쌓인 것만 읽는다.
비유: 손님(화면)은 주문 창구(API)에만 말하고, 주방(서버)이 요리사(AI)에게 한 접시씩 시켜 선반(DB)에 올린다.
왜: 구경하는 사람이 몇 명이든 AI 호출은 토론당 정해진 횟수만 일어나게 하려고.

## 개발자 상세
```
frontend/ (Vite React TS)
  src/app/        라우터·queryClient.ts(재시도 정책)·레이아웃(GNB·Footer)
  src/pages/      화면 단위(HomePage, CreatePage, PredictPage, StagePage, ResultPage, NotFoundPage …)
  src/components/ 디자인 시스템 컴포넌트(Button, Badge, TabLine, CaptionBox, StepperBar, PredictionCard, StateBlock, Popup …)
  src/features/   기능별 훅·로직(debate, create, auth)
  src/api/        fetch 래퍼(client.ts)와 응답 타입(types.ts)
  src/lib/        browser_id, 최근 만든 토론 저장 등 브라우저 유틸
  src/styles/     tokens.css(디자인 토큰) · global.css
backend/ (FastAPI)
  app/main.py     앱 생성, 라우터 등록, CORS
  app/config.py   환경변수 설정(Settings)
  app/db.py       엔진·세션
  app/models.py   SQLAlchemy 모델
  app/schemas.py  요청·응답 모양(Pydantic)
  app/routers/    API 창구(라우터는 검증·응답만, 판단은 서비스로)
  app/services/   비즈니스 로직(생성 엔진, 검수, 한도, 지표, 심판)
  app/providers/  AI 공급자(HyperCLOVA X·Gemini·Groq·mock)
  app/jobs/       시드 토론·오늘의 토론
  alembic/        DB 마이그레이션
  tests/          pytest
```
- 의존 방향: routers → services → models/providers. 서비스는 라우터를 모른다.
- DB 세션: 다른 모듈은 `from app import db` 후 `db.SessionLocal()`로만 쓴다(테스트가 바꿔 끼움).
- 에러: main.py 전역 핸들러가 404·405·500까지 모두 `{"detail":{"code","message"}}`로 맞춘다. 500은 내부 정보를 로그에만 남김.
- 운영 설정 검증: APP_ENV=production인데 SESSION_SECRET(32자 이상)·CRON_SECRET·Postgres DATABASE_URL이 없으면 서버가 뜨지 않는다.
- 상태 위치: 서버 데이터는 TanStack Query, 화면 안 상태(무대 진행·타자 효과)는 컴포넌트 로컬, 브라우저 기억(browser_id·예측·방금 만든 토론)은 localStorage.
- 배포: Vercel 하나에 프론트 정적 파일 + 파이썬 함수(api/index.py가 backend 앱을 감쌈). vercel.json이 /api/*, /share/*를 함수로, 나머지를 index.html로 보낸다.

최종 수정: 2026-11-22 · 관련: D-001, D-003
