# F-003 승부 예측

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸

## 한눈에 보기
상태: [됨]
무엇을: 토론을 보기 전에 "누가 이길까요?"를 A/B로 고르게 하고, 출연 캐릭터(이름·말버릇·어떤 AI)를 소개한다. 링크 복사·예측 없이 보기도 여기서.
왜: 이름 가리고 판정한 뒤 공개하는 재미(LMArena)로 같이 보는 이유를 만든다(P2). 결과 화면의 "내 예측 vs AI 심판" 비교의 출발점.

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-3·§0-4 DEB_01_001·DEB_01_008·§0-5 Flow B·§7 승부 예측 선택 카드)
- 이 기능이 해결하는 문제: 혼자 보는 도구가 아니라 예측하고 결과를 맞혀 보는 관람 경험(P2).
- 완료 기준: ① A/B 선택 카드(Radio 동작, 선택 시 2px 테두리 + 체크 + "내 예측") ② 출연 캐릭터 카드 2장(이름·편·AI·말버릇) ③ [예측하고 보기] → 예측 저장(브라우저 기준) 후 무대로 ④ [예측 없이 보기]로 건너뛰기 ⑤ 링크 복사(공유 주소 /share/{id}) + "링크를 복사했어요" 토스트 3초 ⑥ 이미 예측했으면 그 값 표시 ⑦ 가려진 토론이면 DEB_01_008 안내 ⑧ 승자 정보 없음
- 화면: /debates/:id → pages/PredictPage.tsx (Figma 18:565, 토스트 23:2463, 가려짐 22:2460)
- API: GET /api/debates/{id}, GET /api/debates/{id}/predictions/me, POST /api/debates/{id}/predictions
- 데이터: predictions(UNIQUE(debate_id, browser_id))

## 결과 (AI 작성 — 구현 후)
- 백엔드: app/routers/predictions.py(POST 예측·GET 내 예측), app/services/audience.py(첫 예측만 인정, UNIQUE 충돌 시 기존 값), app/deps.py(browser_id 헤더 UUID 검증, load_visible_debate), tests/test_predictions.py
- 프론트: pages/PredictPage.tsx, features/predict/(PredictionCard, CastCard, queries), components/(Toast·toastContext, LoadError), features/debate/HiddenDebate.tsx, lib/(clipboard, viewState, korean), 테스트 PredictPage.test.tsx·korean.test.ts
- 실제 구조: 예측 카드는 진짜 라디오 버튼(sr-only)을 label로 감싸 키보드·스크린리더로도 고를 수 있다. 고르기 전 [예측하고 보기]는 aria-disabled(포커스 유지 + 이유 안내).
- 예측·건너뛰기 선택은 localStorage(viewState)에도 남겨 무대의 [결과 바로 보기] 표시 조건에 쓴다(F-004). 서버 예측이 있으면 그 값으로 고정하고 [이어서 보기].
- 링크 복사는 /share/{id} 주소를 복사하고 "링크를 복사했어요" 토스트(3초). 클립보드가 막히면 숨은 입력칸으로 한 번 더 시도, 그래도 안 되면 안내 토스트.
- 화면을 못 불러오면 LoadError가 404 → COM_01_003, 인터넷 끊김 → COM_01_002, 그 밖 → 다시 시도로 나눈다.
- CTA 문구는 받침에 맞춰 "짬뽕으로 / 바다로 예측하고 보기".
- 리뷰 반영: 예측·공감 요청 수 제한(IP 해시, 429), 동시 중복 예측 테스트, 다른 제약 위반은 성공으로 숨기지 않음, 내 예측 불러오는 동안 버튼 비활성, 저장값이 고른 값과 다르면 안내, 저장 중 404·410이면 해당 안내 화면으로, NotFoundState로 components → pages 의존 제거, SIDES·isSide 공통화, 실패 경로 테스트 5개
- 설계 의도와 다른 점:
  - 예측·건너뛰기 선택을 localStorage(viewState)에도 저장한다 — F-004 [결과 바로 보기] 표시 조건(§0-5 Flow B)용. 완료 기준에는 없던 저장소.
  - 이미 예측했으면 [예측 없이 보기]를 숨기고 [이어서 보기]만 둔다(Figma에 예측 후 상태 화면은 없음).
  - /share/{id} 서버 주소는 F-006에서 만든다(그 전까지 복사한 링크는 404).
  - 공감 API(F-004 몫)도 같은 요청 수 제한을 쓰도록 이번 반영 커밋에 함께 들어갔다.

## 리뷰
- [review/SUMMARY.md](review/SUMMARY.md) — 1차 [보완] → 지적 반영 완료(backend 75·frontend 47 테스트 통과)

## 열린 질문
- 없음

## 면접 예상 질문
1. 로그인 없이 "한 사람당 한 번 예측"을 어떻게 지켰고, 한계는 무엇인가?
2. 같은 사람이 두 탭에서 동시에 예측을 누르면 어떻게 되나?
3. 예측 카드를 div 클릭이 아니라 라디오 버튼으로 만든 이유는?
- 답: (AI 대리 작성 — 사용자 위임) 1) 브라우저에 저장한 무작위 번호(browser_id)와 DB의 UNIQUE(debate_id, browser_id)로 막았다. 번호는 지우고 새로 만들 수 있어 완벽하진 않아서, 접속 주소를 해시한 값으로 10분에 30개까지만 받게 양을 묶었다. IP 원문은 저장하지 않는다. 2) 먼저 조회해 있으면 그 값을 주고, 없어서 둘 다 저장하려 하면 DB가 하나만 받고 나머지는 IntegrityError가 난다. 그걸 잡아 롤백한 뒤 먼저 저장된 값을 돌려준다. 화면은 돌아온 값이 고른 값과 다르면 "그 값으로 이어서 볼게요"라고 알린다. 3) 하나만 고르는 선택이라 의미상 라디오다. 진짜 radio를 label로 감싸면 키보드 화살표·스크린리더 읽기가 그대로 되고, 고르기 전 주 버튼은 aria-disabled로 포커스는 남긴 채 이유를 읽어 준다.
