# F-006 공유

## 내가 할 일
- 배포 때 확인: 환경변수 PUBLIC_BASE_URL에 https 배포 주소(없으면 운영 서버가 뜨지 않음)
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸
- 배포 때 결정: 카카오톡 공유용 키(카카오 JavaScript 키) 발급·등록 → Q-014

## 한눈에 보기
상태: [됨]
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
  - 신고로 가려진 토론은 공유 미리보기에 주제 대신 "Agora AI 토론장"을 보여 준다(신고된 문구가 메신저로 퍼지지 않게, 이동은 그대로).
- 리뷰 반영: 가려진 토론 미리보기 주제 숨김·짧은 캐시, 이미지 렌더 실패 시 바탕 이미지, CDN이 캐시하게 s-maxage·immutable, 폰트 파일은 굵기마다 한 번만 열기, 운영에서 PUBLIC_BASE_URL이 https 주소가 아니면 기동 중단, crons는 F-008로 옮김, 카카오 SDK SRI, 배포 번들 범위 축소(includeFiles·.vercelignore), lib/share.ts로 공유 주소 규칙 모음, deps.load_debate, 테스트 backend 4·frontend 4 추가

## 리뷰
- [review/SUMMARY.md](review/SUMMARY.md) — 1차 [보완] → 지적 반영 완료(backend 105·frontend 82 테스트 통과)

## 열린 질문
- Q-014

## 면접 예상 질문
1. SPA인데 카카오톡 링크 미리보기를 어떻게 보여 줬나?
2. 사용자가 쓴 주제를 HTML에 넣는데 위험하지 않나?
3. 미리보기 이미지를 매번 그리면 비용이 크지 않나?
- 답: (AI 대리 작성 — 사용자 위임) 1) 메신저 봇은 자바스크립트를 실행하지 않아서, /share/{id}를 서버(FastAPI)가 og 태그가 든 작은 HTML로 직접 주고 meta refresh로 승부 예측 화면에 보낸다. 승자는 넣지 않는다. 2) 주제는 html.escape로 이스케이프하고, 이동 주소는 설정값과 서버가 만든 토론 ID로만 조립한다. 가려진 토론은 주제를 아예 빼고 일반 문구를 쓴다. 3) Pillow로 그리되 s-maxage·immutable 헤더로 CDN이 하루 캐시하게 했고, 폰트 파일은 한 번만 열어 크기만 바꿔 쓴다. 그리다 실패해도 바탕 이미지를 줘서 링크는 그대로 동작한다.
