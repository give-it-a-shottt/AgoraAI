# F-000 세팅·공통 뼈대

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸

## 한눈에 보기
상태: [됨]
무엇을: 프론트·백엔드 폴더, 디자인 토큰, 공통 GNB·푸터, 라우터, 404 화면, DB 표 구조(마이그레이션)를 만든다.
왜: 모든 기능이 같은 뼈대 위에서 같은 규칙(토큰·에러 모양·DB)으로 만들어지게 하려고.

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-1·§1·§3·§8)
- 이 기능이 해결하는 문제: 기능마다 색·간격·에러 모양·DB 접속을 따로 만들면 어긋난다. 한 번에 공통 기반을 깐다.
- 완료 기준: ① 프론트 빌드·린트 통과 ② 백엔드 테스트 통과 ③ 모든 화면에 GNB(PC Type A)와 푸터(무대 제외) ④ 없는 주소는 COM_01_003 ⑤ DB 표 6개가 마이그레이션 한 번으로 생성
- 화면: 공통 레이아웃(app/Layout.tsx), 404(pages/NotFoundPage.tsx), 이용약관·개인정보처리방침 임시 페이지
- API: GET /api/health
- 데이터: users, debates, utterances, predictions, empathies, reports (overview/data-model.md)

## 결과 (AI 작성 — 구현 후)
- 프론트: frontend/src/styles/(tokens·typography·global), components/(Button, Logo, Character, StateBlock), app/(Gnb, Footer, Layout, router), pages/(NotFoundPage, LegalPage), api/client.ts, lib/browserId.ts
- 백엔드: backend/app/(config, db, models, timeutil, characters, errors, main), alembic/versions/…_initial_schema.py, tests/(conftest, test_health)
- 캐릭터 그림 3종은 Figma Characters 컴포넌트를 SVG로 내려받고, 내보낼 때 딸려 온 부모 프레임 배경 사각형 2개만 지웠다(캐릭터 자체는 그대로).
- 리뷰 반영: 전역 에러 핸들러(404·405·500 공통 모양), 운영 비밀값 검증, 폰트 직접 배포, app/queryClient.ts, RouteErrorPage, 초기 마이그레이션 재생성(중복 인덱스 제거·DB 기본값)
- 설계 의도와 다른 점: GNB 메뉴 "오늘의 토론 · 지난 토론"은 IA에 없어서 홈(/)과 홈 목록 최신 탭으로 임시 연결(Q-006). GitHub 링크 주소는 환경변수 VITE_GITHUB_URL로 받고 없으면 글자만 표시.

## 리뷰
- [review/SUMMARY.md](review/SUMMARY.md) — 1차 [보완] → 지적 반영 완료(백엔드 10·프론트 11 테스트 통과)

## 열린 질문
- Q-006, Q-008, Q-009

## 면접 예상 질문
1. 디자인 토큰을 CSS 변수로 둔 이유는? Tailwind를 안 쓴 이유는?
2. 로컬은 SQLite, 배포는 Postgres인데 차이로 생길 수 있는 문제는?
3. API 에러 모양을 하나로 통일하면 프론트에서 무엇이 쉬워지나?
- 답: (AI 대리 작성 — 사용자 위임) 1) Figma 변수 이름을 그대로 옮겨 디자인과 코드가 같은 이름을 쓰게 했고, 설계 문서가 "Tailwind 설치 금지·토큰 값 고정"을 원칙으로 함. 2) 날짜·잠금(동시성) 동작과 대소문자 비교가 다를 수 있어서, 시간은 UTC로 통일하고 잠금은 조건부 UPDATE처럼 두 DB에서 똑같이 도는 방식만 씀. 3) code로 화면 분기(한도 초과·거절 등)를 하고 message는 그대로 보여 주면 돼서 화면마다 에러 해석 코드를 안 만들어도 됨.
