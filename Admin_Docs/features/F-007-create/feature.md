# F-007 로그인·토론 만들기

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸
- 배포 때 등록: 구글·카카오 로그인 키(환경변수 GOOGLE_CLIENT_ID·GOOGLE_CLIENT_SECRET·KAKAO_REST_KEY·KAKAO_CLIENT_SECRET)와 각 콘솔의 리디렉션 주소
- 배포 때 결정: 하루 한도(Q-001·Q-002), 같은 주제 중복 허용(Q-003), 추천 칩 문구(Q-015), 로그인 유지 기간(Q-016), AI 확인 횟수(Q-017), 로그인 모달 시점(Q-018), 가려진 토론 처리(Q-019)
- 배포 때 실행: DB 마이그레이션 `alembic upgrade head`(daily_usage 표·users.session_version 추가)
- 배포 때 확인: Vercel Preview 환경변수는 운영과 다른 SESSION_SECRET·DB로(복사 금지), 운영 Postgres에서 동시 요청 한도 확인(테스트는 SQLite에서만 돎)

## 한눈에 보기
상태: [됨]
무엇을: 로그인한 사람이 A·B 두 선택지를 써서 새 밸런스 게임 토론을 만든다. 추천 칩, 비슷한 토론 안내, 남은 횟수를 보여 주고, 서버가 주제를 확인(금지 주제·한도·전체 마감)한 뒤 통과하면 토론을 만들어 승부 예측 화면으로 보낸다.
왜: 보는 것만이 아니라 "내 주제로 AI가 싸우는 것"을 보게 해서 다시 오게 한다. 무료 AI 한도가 있어 로그인과 하루 횟수로 사용량을 지킨다.

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-4 CRT_01_001~007·COM_01_001, §0-5 Flow B)
- 이 기능이 해결하는 문제: 사용자가 직접 주제를 넣어 토론을 만들되, 무료 AI 사용량과 부적절한 주제로부터 서비스를 지킨다.
- 완료 기준: ① GNB [토론 만들기] → /create ② 게스트가 시작하면 로그인 모달(구글·카카오), 취소하거나 로그인하러 다녀와도 입력 유지 ③ 추천 칩, A·B 각 2~30자(라벨 있음) ④ 입력 중 "비슷한 토론이 있어요"(순서·띄어쓰기만 다른 것도 같은 주제) ⑤ 남은 횟수 표시, 없으면 입력 전에 CRT_01_004 ⑥ 주제 확인 중(CRT_01_002) → 통과: 승부 예측 / 금지 주제: 이유 + 안전한 주제 추천(차감 없음) / 확인 실패: 다시 시도(차감 없음) / 전체 마감: 개인 한도와 별개 안내
- 화면: /create (pages/CreatePage.tsx, Figma 23:2266·23:2285), 전역 로그인 모달(features/auth/LoginModal.tsx)
- API: GET /api/debates/similar, GET /api/me/quota, POST /api/debates, /api/auth/*
- 데이터: users(새로 씀), debates.creator_id(누가 만들었나 — 하루 횟수는 이걸로 셈)

## 결과 (AI 작성 — 구현 후)
- 백엔드
  - services/auth.py: 구글·카카오 OAuth(state 쿠키로 위조 요청 막기, 로그인 뒤 돌아갈 주소는 같은 사이트 경로만 — safe_next), 서명된 세션 쿠키(HttpOnly·SameSite=Lax·운영에서 Secure, 30일), upsert_user
  - routers/auth.py: providers, me, {provider}/login, {provider}/callback(실패하면 "/?login=failed"), dev-login(운영에서는 404), logout
  - services/creation.py: 주제 다듬기(2~30자, 꺾쇠 기호 금지) → 로컬 금지어 → 내 하루 자리 잡기 → 전체 하루 자리 잡기 → AI 확인 횟수(사람당·전체) → 심판 AI 주제 확인 → 토론 생성. 거절·실패면 만들기 자리를 돌려줘 횟수가 줄지 않는다(AI를 실제로 불렀으면 확인 횟수는 그대로 씀, 전체 확인 횟수가 다 차서 부르지 못했으면 돌려줌)
  - services/usage.py + daily_usage 표: `UPDATE … SET used = used + 1 WHERE used < limit` 한 문장으로 자리를 잡는다. 몇 초짜리 AI 확인 중에 같은 사람이 또 보내도 한도를 넘지 않는다
  - routers/create.py: GET /api/debates/similar, GET /api/me/quota, POST /api/debates(201, 생성은 백그라운드로 이어짐)
  - deps.py: current_user / require_user(LoggedInUser)
  - tests/test_create.py, alembic 1910c9316db2(daily_usage, users.session_version)
- 프론트
  - features/auth/(auth.tsx AuthProvider, authContext.ts useAuth·meKey, LoginModal.tsx): 앱 전체 로그인 상태, 로그인 모달. Layout이 AuthProvider로 감싸고 GNB 로그인/로그아웃을 연결. 로그아웃하면 남은 횟수 캐시도 지움
  - pages/CreatePage.tsx: CRT_01_001~004·006·007을 한 페이지에서 상태로 전환. 주소의 ?a=&b=(홈 추천 칩)로 미리 채움
  - features/create/(queries.ts, draft.ts 탭 저장소 임시 저장, validate.ts 서버와 같은 입력 규칙, suggestions.ts)
  - components/InputField.tsx: 라벨·글자 수·도움말/오류
  - 테스트: pages/CreatePage.test.tsx(19)
- 설계 의도와 다른 점
  - 디자인 추천 칩 "산 vs 바다"의 "산"은 1글자라 "각 2~30자" 규칙에 걸린다. 규칙은 그대로 두고 칩을 "등산 vs 바다"로 바꿨다(Q-015). 시드 토론의 "산 vs 바다"는 직접 넣는 데이터라 그대로다.
  - 로그인 키가 없는 로컬에서는 "개발용 로그인"이 보인다(운영에서는 API가 404).
  - 멈춘 토론 재시도(F-002)는 전체 마감에 막지 않는다. 재시도는 토론당 3번·60초 대기로 따로 막혀 있다(Q-002 임시 처리와 같음).
  - 설계에 없던 "AI 확인 횟수" 한도를 더했다(리뷰 R2 — 거절을 반복해 무료 한도를 쓰는 것 방지, Q-017).
- 리뷰 반영(1차): 동시 요청 한도 초과 → 자리 먼저 잡기, AI 확인 횟수 제한(429 check_limit), 다시 되는 시각을 UTC로 읽기(9시간 어긋남), 로그아웃 시 세션 버전으로 모든 쿠키 무효, Vercel 위에서는 개발용 로그인 닫힘, 서버 입력 오류(topic_invalid) 문구 표시·스키마 길이 검사를 clean_topic으로 통일, ?login=failed 토스트, 남은 횟수 오류 문구, 로그인 확인 전 [시작] 막기, 비슷한 토론 300ms 디바운스, 에러 → 화면 상태 변환을 features/create/outcome.ts로, 테스트 backend 6·frontend 6 추가

## 리뷰
- [review/SUMMARY.md](review/SUMMARY.md) — 1차 [막힘] → 반영 → 2차(R2·R4) [보완] → 반영 완료(backend 141 · frontend 103 테스트 통과)
- 리뷰 반영(2차): Preview는 운영으로 보지 않음(VERCEL_ENV=production만 운영, 개발용 로그인은 모든 Vercel 환경에서 닫힘), 자리 돌려주기 실패가 원래 예외를 가리지 않게, AI 확인 횟수를 다 쓴 사람은 자리를 잡기 전에 바로 거절, 전체 확인 횟수 소진 시 사람당 확인 횟수 돌려줌

## 열린 질문
- Q-001, Q-002, Q-003, Q-015, Q-016, Q-017, Q-018, Q-019

## 면접 예상 질문
1. 소셜 로그인 콜백에서 위조 요청(CSRF)과 열린 리디렉션은 어떻게 막았나?
2. 하루 생성 횟수는 어디에 저장하고, 거절·실패는 왜 횟수가 줄지 않나?
3. 같은 주제를 순서만 바꿔 넣으면 어떻게 "비슷한 토론"으로 알아보나?
- 답: (AI 대리 작성 — 사용자 위임) 1) 로그인을 시작할 때 무작위 state를 서명된 쿠키에 넣고, 콜백의 state와 같을 때만 받는다(10분 제한). 돌아갈 주소는 "/"로 시작하는 같은 사이트 경로만 허용하고 "//"나 역슬래시는 홈으로 바꾼다. 2) daily_usage 표에 (사람, 한국 날짜)별 칸을 두고, 검사 전에 `used < 한도`일 때만 1 올리는 UPDATE 한 문장으로 자리를 잡는다. 처음엔 만든 토론 수를 COUNT했는데, AI 확인이 몇 초 걸리는 사이 동시 요청이 같은 "남음"을 봐서 한도를 넘을 수 있다는 리뷰를 받고 바꿨다. 거절·실패면 자리를 돌려줘서 횟수가 줄지 않는다. 3) 두 주제에서 공백을 지우고 소문자로 바꾼 뒤 정렬해 normalized_key를 만들고, 그 키로 기존 토론을 찾는다.
