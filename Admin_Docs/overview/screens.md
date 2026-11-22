# 화면 목록과 라우팅

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 어떤 주소(URL)가 어떤 화면으로 가는지. 화면 ID는 agora-design.md §0-4 IA 표와 같다.
왜: 리뷰어(R4)가 실제 라우터 코드와 비교하는 기준.

## 개발자 상세
| URL | 화면 파일 | 화면 ID | 비고 |
|---|---|---|---|
| / | pages/HomePage.tsx | HOM_01_001, HOM_01_002(빈 상태) | GNB "오늘의 토론" = /, "지난 토론" = /?sort=latest#browse (Q-006) |
| /create | pages/CreatePage.tsx | CRT_01_001~004·006·007 | 단계·상태를 한 페이지 안에서 전환, 비로그인 시 COM_01_001 |
| /debates/:id | pages/PredictPage.tsx | DEB_01_001, DEB_01_008(가려짐) | |
| /debates/:id/stage | pages/StagePage.tsx | DEB_01_002, DEB_01_007(멈춤) | 푸터 없음 |
| /debates/:id/result | pages/ResultPage.tsx | DEB_01_003, DEB_01_009(판정 실패), 팝업 DEB_01_004·005·006 | |
| /terms, /privacy | pages/LegalPage.tsx | - | 임시 안내 (Q-008) |
| * | pages/NotFoundPage.tsx | COM_01_003 | |
| (오류) | pages/RouteErrorPage.tsx | - | 화면을 그리다 예상 못 한 오류(라우터 errorElement) |
| (전역) | features/auth/LoginModal.tsx (Layout의 AuthProvider가 띄움) | COM_01_001 | 로그인 뒤 원래 주소로, 만들기 입력은 탭 저장소에 유지 |
| (전역) | components/StateBlock + NetworkError | COM_01_002 | 요청 실패 시 각 화면 안에 표시 |
| (서버) /share/:id | backend share 라우터 | - | OG HTML → /debates/:id |

Figma PC 노드 ID(파일 페이지 "Screens PC"): 홈 19:728 · 홈 빈 22:2020 · 만들기 23:2266 · 확인 중 22:1944 · 거절 22:2107 · 한도 22:2187 · 마감 22:2263 · 확인 실패 22:2326 · 예측 18:565 · 예측 토스트 23:2463 · 무대 17:462 · 멈춤 22:2397 · 가려짐 22:2460 · 결과 18:715 · 판정 실패 23:2345 · 공유 24:2478 · 지표 24:2556 · 신고 24:2625 · 로그인 24:2706 · 네트워크 22:2531 · 404 22:2607

최종 수정: 2026-11-22 · 관련: F-000~F-009
