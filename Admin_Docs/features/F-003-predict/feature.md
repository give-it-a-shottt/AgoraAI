# F-003 승부 예측

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸

## 한눈에 보기
상태: [일부] — 리뷰 진행 중
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
- 설계 의도와 다른 점: 없음. (/share/{id} 서버 주소 자체는 F-006에서 만든다 — 그 전까지 복사한 링크는 404)

## 리뷰
- (작성 예정)

## 열린 질문
- 없음

## 면접 예상 질문
- (작성 예정)
