# F-000 리뷰 요약

## 내가 할 일
- 배포 때 확인: 아래 "최종 판정"은 AI 대리 작성 — 동의하지 않는 줄이 있으면 고쳐 주세요

## 한눈에 보기
상태: [보완] → 지적 반영 완료(테스트로 확인)
회차: 1차 (2026-11-22)
한 줄 요약: [위험] 없음. [주의] 4개(테스트 부족 2, 운영 비밀값 검증, 개발 의존성 취약점)는 모두 고쳤고, [제안]은 대부분 반영했다.

## 지적 목록 ([위험] → [주의] → [제안] 순)
- [주의] [확실] 운영에서 비밀값이 비었거나 개발용이어도 서버가 뜸(쿠키 위조·cron 무단 호출 위험) — backend/app/config.py Settings — R2 — production 검증 추가, 빈 값은 기본값 사용(env_ignore_empty)
- [주의] [확실] vitest 개발 의존성에 Critical 취약점(tinypool) — frontend/package.json — R2 — vitest 5로 올림(audit 0건)
- [주의] [확실] 공통 기반 로직·완료 기준 ④⑤ 테스트 없음 — backend/tests, frontend — R3 — 백엔드 9개·프론트 11개 테스트 추가
- [주의] [확실] 테스트가 마이그레이션을 거치지 않음 — backend/tests/conftest.py — R1 — alembic upgrade head + alembic check 테스트 추가
- [제안] [확실] 404·405·500이 공통 에러 모양이 아님 — backend/app/main.py — R3·R4 — 전역 핸들러 추가
- [제안] [확실] 겹치는 인덱스 3개 — models.py — R1·R2 — 제거 후 초기 마이그레이션 다시 생성
- [제안] [확실] NOT NULL 칸에 DB 기본값 없음 — 마이그레이션 — R1 — server_default 추가
- [제안] [확실] 외부 폰트 CSS를 SRI 없이 로드 — frontend/index.html — R2 — npm 패키지(pretendard, @fontsource/poppins)로 직접 배포
- [제안] [확실] 성공 응답인데 JSON이 아니면 null 반환 — frontend/src/api/client.ts — R3 — invalid_response 에러로
- [제안] [확실] QueryClient 위치가 문서와 다름 — main.tsx — R1 — app/queryClient.ts로 분리
- [제안] [확실] Layout의 GNB 임시 값·inline style — Layout.tsx — R1 — TODO(F-007) 표시, CSS Module로
- [제안] [확실] alembic이 db.py 비공개 함수 사용 — env.py — R1 — normalize_url로 공개
- [제안] [확실] screens.md `/today`가 코드와 다름 — screens.md — R4 — 문서에서 빼고 Q-006 임시 처리 반영
- [제안] [추정] GitHub 링크 주소가 질문에 없음 — Footer.tsx — R4 — Q-009 추가
- [제안] [추정] 렌더 오류용 errorElement 없음 — router.tsx — R3 — RouteErrorPage 추가
- [제안] [추정] conftest SessionLocal 교체는 속성 접근에만 먹힘 — conftest.py — R1 — db.py·architecture.md에 "db.SessionLocal()로만 접근" 규칙 명시
- [제안] [확실] 아직 안 쓰는 상수(TOTAL_UTTERANCES 등)·providers/__init__.py 없음 — models.py, characters.py — R1 — 거절(아래)
- [제안] [추정] GNB "지난 토론" 판정 방식 — Gnb.tsx — R1 — Q-006 임시 처리와 관련, 확정 때 정리

## 최종 판정 (AI 대리 작성 — 사용자 위임)
- 수용할 지적과 이유: [주의] 4개 전부 — 보안(운영 비밀값)·취약점·검증 공백이라 배포 전에 막아야 함. [제안] 중 첫 마이그레이션일 때 고치는 게 가장 싼 것(인덱스·기본값), 에러 모양 통일, 폰트 직접 배포, 문서-코드 불일치는 바로 반영.
- 거절할 지적과 이유: 안 쓰는 상수·providers/__init__.py — 바로 다음 기능(F-001 캐릭터 정보, F-002 생성 엔진)에서 쓰고 만든다.
- 다음에 고칠 것: GNB 로그인 연결(F-007), GNB "지난 토론" 판정은 Q-006 답이 나오면.

## 개발자 상세 (AI 근거용 — 안 읽어도 됨)
### 리뷰어별 결과
| 리뷰어 | 모델 | 판정 | 위험 | 주의 | 제안 | 신규 | 추정 | 근거 검토 |
|---|---|---|---|---|---|---|---|---|
| R1 구조·가독성 | Sonnet 5.5 | 지적 있음 | 0 | 1 | 8 | - | 2 | 타당 |
| R2 보안·성능 | Opus 5.5 | 지적 있음 | 0 | 2 | 2 | - | 0 | 타당 |
| R3 예외·테스트 | Sonnet 5.5 | 지적 있음 | 0 | 1 | 3 | - | 1 | 타당 |
| R4 설계 의도·API | Sonnet 5.5 | 지적 있음 | 0 | 0 | 3 | - | 1 | 타당 |
### 근거 검토 결과 (AI 1차)
- 네 리뷰어 모두 체크 항목마다 위치·결과(해당 없음·미확인 포함)를 적었고 확신 표시도 확인 범위와 맞아 재실행 없음.
- 패킷 방식: 첫 커밋이라 diff 대신 핵심 파일 목록을 주고 리뷰어가 그 파일만 열게 함(생략 파일은 CSS·설정·lock 파일).
- 반영 확인: backend `uv run pytest` 10 passed(마이그레이션·에러 모양·운영 설정 포함), frontend `npm test` 11 passed · build · lint 통과, `npm audit` 0건.
- 2차 리뷰: [위험]이 없고 [주의]는 모두 테스트로 확인되는 수정이라 2차 회차는 돌리지 않음(위임 운영 원칙).
