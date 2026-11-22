# F-005 결과·심판·지표·신고

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸
- 배포 때 결정: 사람 분류 일치율을 언제 잴지 → Q-004

## 한눈에 보기
상태: [됨]
무엇을: 토론이 끝나면 심판 부엉이(Groq)가 승자와 이유를 정하고, 발언마다 "반박했나/맞장구쳤나"를 표시해 품질 지표를 만든다. 결과 화면은 내 예측 vs AI 심판, 관객 수, 지표를 보여 주고 신고를 받는다.
왜: 같이 보는 재미의 끝(예측 확인, P2)과 "AI끼리 쉽게 동의하지 않았나"를 숫자로 보여 주는 서비스의 핵심 차별점(P5).

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-2 P5·§0-4 DEB_01_003·005·006·009·§0-5 Flow C·§4 결과 와이어프레임·§7 신고 진입점·§8 품질 지표)
- 이 기능이 해결하는 문제: AI끼리 쉽게 동의해 심심함(P5)을 지표로 드러내고, 예측 결과를 확인하게 한다(P2).
- 완료 기준: ① 6발언이 모이면 심판 판정(승자·이유·발언별 태도) ② 반박률·동의율 계산·표시("제대로 맞붙은 발언 78%" 식으로 풀어 씀) ③ 내 예측 vs AI 심판(적중·빗나감은 아이콘 + 글자, 예측 없으면 "다음엔 예측해 보세요") ④ 관객은 5명 이상일 때만 분포, 아니면 "관객 N명 참여" ⑤ [어떻게 쟀나요] 지표 설명 팝업(규칙 + 사람 분류 일치율) ⑥ 판정 실패면 DEB_01_009(발언은 그대로, 판정 다시 요청) ⑦ 결과 화면 맨 아래 "이 토론 신고하기" → 이유 선택 → 3건이면 가림 ⑧ 승자는 결과 API에서만, 토론이 끝난 뒤에만 ⑨ PC Layer Popup / MO Bottom Sheet
- 화면: /debates/:id/result → pages/ResultPage.tsx (Figma 18:715, 판정 실패 23:2345, 지표 24:2556, 신고 24:2625)
- API: GET /api/debates/{id}/result, POST /api/debates/{id}/judge/retry, POST /api/debates/{id}/reports
- 데이터: debates(winner, judge_reason, judge_status, judge_attempts, rebut_rate, agree_rate, is_hidden), utterances(stance_label), reports

## 결과 (AI 작성 — 구현 후)
- 백엔드: app/services/judging.py(판정·지표·판정 잠금·needs_judging), app/services/results.py(결과 조립·관객 분포·신고 3건 가림), app/routers/results.py, generation.run_until_done이 완료 직후 판정 호출, 마이그레이션 judge_attempts, ReportReason을 화면 이유 5개로 맞춤, tests/test_results.py(14)
- 프론트: pages/ResultPage.tsx, features/result/(MetricsPopup, ReportPopup, queries, format), components/Popup.tsx(Layer Popup·Bottom Sheet 공통 — 포커스 가두기·Esc·딤 닫기·포커스 복귀), 테스트 ResultPage.test.tsx(9)
- 실제 구조:
  - 판정은 생성이 끝나는 백그라운드 작업 안에서 바로 한다. 판정이 끊겨 pending으로 남으면 결과 API를 열 때 다시 건다(needs_judging). 판정 중복은 lock_until 조건부 UPDATE로 막고, 시도는 토론당 4번까지(judge_attempts).
  - 결과 화면은 판정 중(pending)이면 2.5초마다 다시 읽는다. 승자·이유·지표는 judge_status=done일 때만 응답에 담긴다.
  - 신고는 브라우저당 1번 + 접속자당 1시간 10건 제한, 3건이 되면 is_hidden=true(목록·상세에서 가려짐).
  - [결과 공유하기]는 F-006에서 공유 시트로 바꾼다(지금은 공유 주소 복사).
- 리뷰 반영: 신고 가림은 서로 다른 접속자 3곳 기준(한 사람이 브라우저 번호만 바꿔 혼자 가리지 못함, Q-013), 가린 토론 되돌리기 스크립트(app/jobs/unhide.py), 마지막 판정 중 작업이 죽어 굳은 pending은 실패로 확정(settle_stuck), 판정 다시 요청은 백그라운드로(요청이 AI를 기다리지 않음, 바로 pending), 또 실패하면 안내·상한이면 버튼 숨김, 결과 폴링 약 2분 상한, 지표 분모를 5로 고정, 카드·미터를 features/result로, 판정 규칙 isJudged·숫자 상수 모음, 신고 팝업은 열 때마다 선택 초기화, 테스트 backend 10·frontend 4 추가
- 설계 의도와 다른 점:
  - "사람 분류와의 일치율"은 아직 측정 전이라 팝업에 "아직 재는 중이에요"로 표시(Q-004).
  - [결과 공유하기]는 지금 공유 주소 복사만 한다 — agora-design Flow C의 공유 시트는 F-006에서.
  - "신고 3건"을 서로 다른 접속자 3곳으로 센다(Q-013).

## 리뷰
- [review/SUMMARY.md](review/SUMMARY.md) — 1차 [막힘] → 지적 반영 완료(backend 97·frontend 77 테스트 통과)

## 열린 질문
- Q-004, Q-013

## 면접 예상 질문
1. 승자가 결과 화면 전에 새지 않게 어떻게 막았나?
2. 로그인 없는 신고로 남의 토론을 가리는 악용은 어떻게 막았나?
3. 심판 AI 호출이 실패하거나 중간에 끊기면 결과 화면은 어떻게 되나?
- 답: (AI 대리 작성 — 사용자 위임) 1) 승자 칸은 결과 응답(ResultOut) 하나에만 있고, 토론이 끝나고(done) 판정까지 끝나야(judge_status=done) 값을 넣는다. 목록·상세·공유 미리보기 응답 모양에는 승자 칸 자체가 없다. 2) 브라우저 번호는 새로 만들 수 있어서, 가림 기준을 "서로 다른 접속자(IP 해시) 3곳"으로 셌다. IP 원문은 저장하지 않는다. 잘못 가려지면 운영자가 스크립트로 되돌린다. 3) 실패하면 judge_status=failed로 DEB_01_009 카드에서 다시 요청할 수 있다(토론당 4번). 다시 요청은 바로 대기로 돌려주고 백그라운드에서 판정하며, 작업이 끊겨 대기로 굳으면 서버가 실패로 정리하고 화면 폴링도 2분 뒤 멈춘다.
