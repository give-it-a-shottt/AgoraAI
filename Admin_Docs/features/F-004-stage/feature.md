# F-004 무대

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸
- 배포 때 확인: 디자인은 직접 확인해 주세요(타자 효과 속도·자막 등장)

## 한눈에 보기
상태: [일부] — 리뷰 진행 중
무엇을: 토론을 한 발언씩 보여 준다. 말하는 캐릭터 한 명만 크게, 글자가 타자 치듯 나오고 다 나오면 핵심 한 구절이 예능 자막처럼 뜬다. 생성 중이면 쌓인 발언부터 보여 주고 새 발언이 오면 이어서.
왜: 서비스의 "기억에 남는 한 가지"(노랑 자막 박스)와 1~3분 생성 대기 중 이탈(P3)을 줄이는 핵심 화면.

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-4 DEB_01_002·DEB_01_007·§0-5 Flow B·§3·§4 와이어프레임·§5 원칙·모션 표·§8 접근성·대기 시간 초과)
- 이 기능이 해결하는 문제: 생성 대기 중 이탈(P3), 말풍선이 쌓이는 채팅 구조 탈피, 한국 예능 자막의 재미(P1).
- 완료 기준: ① 한 번에 한 캐릭터만(화자 크게, 다음 차례 작게 "반박 준비 중") ② Stepper Bar 3단(1R 주장·2R 반박·3R 마무리, `<ol>` + aria-current) ③ 타자 효과 글자당 20ms, [다음 발언]을 누르면 즉시 완성 ④ 자막 박스는 발언이 다 나온 뒤 하나만(200ms, 동작 줄이기면 opacity만) ⑤ 공감 한 번 탭(발언마다) ⑥ 다시보기(완료된 토론)는 자동 진행 + 정지·재생 버튼(aria-pressed, 마우스·포커스 올리면 멈춤) ⑦ 생성 중이면 쌓인 발언부터, 새 발언이 오면 이어서 — 다음 발언이 없으면 [다음 발언] aria-disabled + 이유 ⑧ 대기 30초 "생각보다 오래 걸리고 있어요", 60초 Error Inline + [다시 시도] ⑨ 멈춘 토론은 DEB_01_007(다시 시도·N라운드까지 보기) ⑩ 지난 발언 펼쳐 보기 ⑪ [결과 바로 보기]는 예측 또는 건너뛰기 뒤에만 ⑫ 끝나면 결과로 ⑬ 접근성: 발언 전체 글자는 DOM에, 타자 층은 aria-hidden, 화자 교체 시 aria-live "2R 반박 · 냥냥이 발언", 자막 숨김 라벨 "핵심 한 줄:" ⑭ 푸터 없는 몰입형
- 화면: /debates/:id/stage → pages/StagePage.tsx (Figma 17:462, 멈춤 22:2397)
- API: GET /api/debates/{id}, GET /api/debates/{id}/utterances?after=, POST /api/debates/{id}/retry, POST /api/utterances/{id}/empathy
- 데이터: utterances(읽기), empathies

## 결과 (AI 작성 — 구현 후)
- 프론트: pages/StagePage.tsx(상태·흐름), features/stage/(useTypewriter, StepperBar, CaptionBox, PastUtterances, queries), lib/useReducedMotion.ts, lib/korean.ts(withIGa), components/StateBlock(텍스트 보조 버튼), 라우트 /debates/:id/stage(푸터 숨김), 테스트 StagePage.test.tsx(11)
- 백엔드: 공감 API(POST /api/utterances/{id}/empathy)는 F-003 반영 커밋(d0ab1fc)에 요청 수 제한과 함께 들어갔다.
- 실제 구조:
  - 발언 목록은 생성 중일 때만 2.5초마다 다시 읽는다(완료·멈춤이면 멈춤). 화면은 서버가 쌓은 발언만 보여 준다.
  - 처음 열 때 이미 완료된 토론이면 "다시보기": 자막이 뜨고 2.5초 뒤 자동으로 다음 발언, 정지·재생 버튼(aria-pressed), 마우스·포커스가 무대 위에 있으면 멈춤. 생성 중에 열면 사용자가 [다음 발언]으로 넘긴다.
  - [다음 발언]: 타자 중이면 즉시 완성 → 다음 발언 → 마지막이면 [결과 보기]. 다음 발언이 아직 없으면 aria-disabled + "펭펭이가 2R 반박 준비 중이에요"(화면·숨김 설명 둘 다).
  - 기다린 지 30초면 "생각보다 오래 걸리고 있어요", 60초면 Error Inline + [다시 시도](목록을 다시 읽으면 서버가 멈춘 작업을 깨움).
  - 멈춘 토론(paused)은 DEB_01_007: [다시 시도](POST retry — 429면 "N초 뒤", 409 retry_limit이면 안내) · [N라운드까지 보기].
  - 공감은 발언마다 한 번(누르면 바로 눌림 표시, 실패하면 되돌림).
  - 타자 효과: 발언 전체는 sr-only로 DOM에, 글자가 나오는 층은 aria-hidden. 동작 줄이기면 즉시 표시, 자막은 opacity만.
- 설계 의도와 다른 점: 60초 Error Inline의 [다시 시도]는 생성 중(paused 아님)이라 재시도 API 대신 목록을 다시 읽는다(서버 needs_kick이 깨움).

## 리뷰
- (작성 예정)

## 열린 질문
- Q-005

## 면접 예상 질문
- (작성 예정)
