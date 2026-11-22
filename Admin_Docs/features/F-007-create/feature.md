# F-007 로그인·토론 만들기

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸
- 배포 때 등록: 구글·카카오 로그인 키(환경변수 GOOGLE_CLIENT_ID·GOOGLE_CLIENT_SECRET·KAKAO_REST_KEY·KAKAO_CLIENT_SECRET)와 각 콘솔의 리디렉션 주소
- 배포 때 결정: 하루 한도(Q-001·Q-002), 같은 주제 중복 허용(Q-003), 추천 칩 문구(Q-015), 로그인 유지 기간(Q-016)

## 한눈에 보기
상태: [일부] (리뷰 전)
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
  - services/creation.py: 주제 다듬기(2~30자, 꺾쇠 기호 금지) → 로컬 금지어 → 내 하루 횟수(한국 날짜, 내가 만든 토론 수) → 전체 하루 마감(사용자가 만든 토론 수, 시드 제외) → 심판 AI 주제 확인 → 토론 생성. 거절·실패는 토론을 만들지 않으므로 횟수가 줄지 않는다
  - routers/create.py: GET /api/debates/similar, GET /api/me/quota, POST /api/debates(201, 생성은 백그라운드로 이어짐)
  - deps.py: current_user / require_user(LoggedInUser)
  - tests/test_create.py
- 프론트
  - features/auth/(auth.tsx AuthProvider, authContext.ts useAuth·meKey, LoginModal.tsx): 앱 전체 로그인 상태, 로그인 모달. Layout이 AuthProvider로 감싸고 GNB 로그인/로그아웃을 연결. 로그아웃하면 남은 횟수 캐시도 지움
  - pages/CreatePage.tsx: CRT_01_001~004·006·007을 한 페이지에서 상태로 전환. 주소의 ?a=&b=(홈 추천 칩)로 미리 채움
  - features/create/(queries.ts, draft.ts 탭 저장소 임시 저장, validate.ts 서버와 같은 입력 규칙, suggestions.ts)
  - components/InputField.tsx: 라벨·글자 수·도움말/오류
  - 테스트: pages/CreatePage.test.tsx(13)
- 설계 의도와 다른 점
  - 디자인 추천 칩 "산 vs 바다"의 "산"은 1글자라 "각 2~30자" 규칙에 걸린다. 규칙은 그대로 두고 칩을 "등산 vs 바다"로 바꿨다(Q-015). 시드 토론의 "산 vs 바다"는 직접 넣는 데이터라 그대로다.
  - 로그인 키가 없는 로컬에서는 "개발용 로그인"이 보인다(운영에서는 API가 404).
  - 멈춘 토론 재시도(F-002)는 전체 마감에 막지 않는다. 재시도는 토론당 3번·60초 대기로 따로 막혀 있다(Q-002 임시 처리와 같음).

## 리뷰
- 아직 안 함

## 열린 질문
- Q-001, Q-002, Q-003, Q-015, Q-016

## 면접 예상 질문
1. 소셜 로그인 콜백에서 위조 요청(CSRF)과 열린 리디렉션은 어떻게 막았나?
2. 하루 생성 횟수는 어디에 저장하고, 거절·실패는 왜 횟수가 줄지 않나?
3. 같은 주제를 순서만 바꿔 넣으면 어떻게 "비슷한 토론"으로 알아보나?
- 답: (AI 대리 작성 — 사용자 위임) 1) 로그인을 시작할 때 무작위 state를 서명된 쿠키에 넣고, 콜백의 state와 같을 때만 받는다(10분 제한). 돌아갈 주소는 "/"로 시작하는 같은 사이트 경로만 허용하고 "//"나 역슬래시는 홈으로 바꾼다. 2) 따로 카운터 테이블을 두지 않고 "오늘(한국 날짜) 내가 만든 토론 수"를 센다. 토론은 검사를 다 통과해야 만들어지니 거절·실패는 자연스럽게 세지 않는다. 3) 두 주제에서 공백을 지우고 소문자로 바꾼 뒤 정렬해 normalized_key를 만들고, 그 키로 기존 토론을 찾는다.
