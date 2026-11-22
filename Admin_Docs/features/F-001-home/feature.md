# F-001 홈

## 내가 할 일
- 배포 때 확인: 설계 의도·면접 답 대리 작성 칸 검토 → 아래 "(AI 대리 작성 — 사용자 위임)" 칸

## 한눈에 보기
상태: [일부] — 리뷰 진행 중
무엇을: 첫 화면. 맨 위에 "오늘의 토론" 한 개를 크게, 아래에 다른 토론 목록(인기·최신 탭)을 주제 문장 위주로 보여 준다.
왜: 방문자의 주 행동은 "관람"이라, 들어오자마자 토론 하나를 바로 볼 수 있게 하려고.

## 설계 의도 (AI 대리 작성 — 사용자 위임, 출처: agora-design.md §0-3·§0-4 HOM_01_001/002·§3·§4·§5)
- 이 기능이 해결하는 문제: 혼자 넣고 혼자 보는 도구가 아니라, 남이 만든 토론을 바로 같이 보게 한다(P2).
- 완료 기준: ① 오늘의 토론(주제·두 캐릭터·편·AI·관객 예측 수·[승부 예측하고 보기]) ② 인기·최신 탭 목록(주제, 진행 중/완료 배지, "관객 N명 예측 · 날짜") ③ 승자는 어디에도 안 보임 ④ 페이지네이션(PC 번호, MO 더 보기) ⑤ 방금 만든 토론 한 줄(브라우저 저장) ⑥ 토론이 하나도 없으면 빈 상태(HOM_01_002, 추천 주제 3개) ⑦ 로딩 중 Skeleton
- 화면: / → pages/HomePage.tsx (Figma 19:728, 빈 상태 22:2020)
- API: GET /api/debates/today, GET /api/debates?sort=popular|latest&page&size
- 데이터: debates(읽기), predictions(개수 세기)

## 결과 (AI 작성 — 구현 후)
- 백엔드: app/routers/debates.py(today·목록·상세), app/services/debate_query.py(조회·예측 수 서브쿼리), app/services/normalize.py(주제 정규화), app/schemas.py(응답 모양 전체), tests/test_home.py·factories.py
- 프론트: pages/HomePage.tsx, features/home/(TodayCard, DebateListSection, DebateRow, HomeEmpty, RecentLine), features/debate/(queries, cast), components/(Badge, TabLine, Pagination, LoadMore, Chip, Skeleton), lib/(date, recentDebates, useMediaQuery), 테스트 HomePage.test.tsx·date.test.ts
- 실제 구조: 정렬·페이지는 주소(?sort=&page=)에 둬서 뒤로 가기·"지난 토론" 메뉴와 맞춘다. PC는 번호 페이지(useQuery), MO(640 미만)는 더보기(useInfiniteQuery).
- 오늘의 토론이 없으면 가장 최근 "오늘의 토론" → 그것도 없으면 가장 최근 완료 토론을 보여 준다. 그것도 없으면 빈 상태.
- 홈 맨 위에 걸린 오늘의 토론은 목록에서 빼서 두 번 안 보이게 했다.
- 설계 의도와 다른 점: 빈 상태 추천 주제 3개는 서버 API 대신 프론트 상수(features/create/suggestions.ts)로 둠(만들기 화면 추천 칩과 같은 목록).

## 리뷰
- (작성 예정)

## 열린 질문
- Q-006

## 면접 예상 질문
1. 목록의 "관객 N명 예측"을 토론마다 따로 세면 무슨 문제가 생기고, 어떻게 피했나?
2. 정렬·페이지 상태를 컴포넌트 state가 아니라 URL에 둔 이유는?
3. 승자를 홈·목록에서 숨기는 걸 화면이 아니라 서버 응답에서 막은 이유는?
- 답: (AI 대리 작성 — 사용자 위임) 1) 토론 5개면 쿼리 6번(N+1)이 된다. 예측 수를 토론별로 묶어 세는 서브쿼리를 한 번 붙여 쿼리 2번(개수·목록)으로 끝냈다. 2) 뒤로 가기·새로고침·링크 공유 때 같은 탭·페이지가 유지되고, GNB "지난 토론"이 주소만으로 최신 탭을 열 수 있다. 3) 화면에서만 숨기면 개발자 도구로 응답을 보면 스포일러가 보인다. 응답 모양(schemas.py)에 아예 winner 칸을 두지 않아 실수로도 못 나가게 했다.
