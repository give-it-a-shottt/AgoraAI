# F-006 공유

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸
- 배포 때 결정: 카카오톡 공유용 키(카카오 JavaScript 키) 발급·등록 → Q-014

## 한눈에 보기
상태: [일부] — 리뷰 진행 중
무엇을: 결과 화면 [결과 공유하기]가 공유 시트를 연다(미리보기 카드, 카카오톡으로 보내기, 링크 복사). 공유 주소 /share/{id}는 서버가 미리보기 정보(제목·이미지)를 담은 페이지를 주고, 받은 사람을 승부 예측 화면으로 보낸다.
왜: 받은 사람도 예측부터 하게 해서(스포일러 방지) 같이 보는 재미를 퍼뜨린다(P2). Vite SPA라 카카오톡이 읽을 미리보기는 서버가 만들어야 한다.

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-4 DEB_01_004·§0-5 Flow C·§5·§7 공유 미리보기 이미지·§8)
- 이 기능이 해결하는 문제: 혼자 보고 끝나는 도구가 아니라 공유로 퍼지는 관람(P2).
- 완료 기준: ① 결과 화면 [결과 공유하기] → 공유 시트(PC Layer Popup / MO Bottom Sheet) ② 미리보기 카드(로고·주제·"누가 이겼을까요? 먼저 예측하고 보세요") + 안내 "받는 사람은 승부 예측부터 봐요" ③ 카카오톡으로 보내기, 링크 복사("링크를 복사했어요" 토스트 3초) ④ /share/{id} → OG 태그(og:title·og:image) HTML → 실제 화면(승부 예측)으로 이동 ⑤ 미리보기 이미지 1200×630, 주제 문장 + Agora 로고, 승자 표시 없음 ⑥ 미리보기 이미지 실패해도 링크는 동작 ⑦ 새로고침 404 방지(vercel.json rewrites)
- 화면: 결과 화면 안 팝업(Figma 24:2478)
- API: GET /share/{id}, GET /api/og/{id}.png
- 데이터: debates(주제만 읽음)

## 결과 (AI 작성 — 구현 후)
- 백엔드: app/services/share.py(OG HTML — 주제는 html.escape, 미리보기 이미지 — Pillow + Pretendard OFL 폰트, 긴 주제는 글자 크기를 줄여 한 줄), app/routers/share.py(GET /share/{id}, GET /api/og/{id}.png, 캐시 헤더), assets/fonts(Pretendard SemiBold·Regular + 라이선스), tests/test_share.py(4)
- 프론트: features/result/SharePopup.tsx(미리보기 카드·안내·카카오·링크 복사), lib/kakao.ts(SDK는 누를 때만 불러옴, 키 없으면 링크 복사로 대신), 결과 화면 [결과 공유하기] 연결, 테스트 1
- 배포: vercel.json(프론트 빌드 결과 + 파이썬 함수 api/index.py, /api/*·/share/*는 함수로, 그 밖은 index.html — 새로고침 404 방지), requirements.txt(uv export), api/index.py
- 실제 구조: 받은 사람이 /share/{id}를 열면 서버가 og 태그 HTML을 주고 meta refresh로 /debates/{id}(승부 예측)로 보낸다. 미리보기 이미지가 실패해도 og:url·링크는 그대로라 이동은 된다.
- 설계 의도와 다른 점:
  - 카카오톡 공유는 카카오 키가 있어야 한다. 키가 없으면 버튼이 [카카오톡용 링크 복사]로 바뀐다(Q-014).
  - vercel.json의 crons(오늘의 토론 하루 1회)는 F-008에서 만들 엔드포인트를 미리 등록해 둔 것.

## 리뷰
- (작성 예정)

## 열린 질문
- Q-014

## 면접 예상 질문
- (작성 예정)
