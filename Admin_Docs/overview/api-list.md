# API 목록

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 화면이 서버에 보내는 요청 목록. 구경·예측·공감·신고는 로그인 없이, 토론 만들기만 로그인이 필요하다.
왜: 화면과 서버가 같은 약속(경로·필드 이름)을 쓰는지 리뷰어(R4)가 비교하는 기준.
💡 승자(winner)는 결과 API에서만 나온다. 목록·상세·공유에는 절대 안 나온다.

## 개발자 상세
공통
- 에러 모양: `{"detail": {"code": "문자열", "message": "사용자에게 보여 줄 한국어"}}` — 없는 주소 404 `not_found`, 메서드 405 `method_not_allowed`, 예상 못 한 오류 500 `internal`도 같은 모양 (검증 오류 422만 FastAPI 기본 모양)
- 브라우저 번호: 예측·공감·신고 요청은 헤더 `X-Browser-Id`(UUID) 필수. 없거나 형식이 틀리면 400 `browser_id_required`
- 로그인: 서명된 세션 쿠키 `agora_session`

| 메서드 · 경로 | 로그인 | 요청 | 응답(성공) | 에러 |
|---|---|---|---|---|
| GET /api/health | - | - | `{ok}` | - |
| GET /api/debates/today | - | - | DebateSummary — 고르는 규칙(Q-010): 오늘까지의 최근 오늘의 토론 → 최근 완료 → 최근 토론 | 404 `no_today`(토론이 하나도 없을 때만) |
| GET /api/debates?sort=popular\|latest&page=1&size=5 | - | - | `{items: DebateSummary[], page, total_pages, total}` — 오늘의 토론(맨 위 카드)은 목록·total에서 뺌. 마지막보다 큰 page는 빈 items | 422(page 1~1000, size 1~20 밖) |
| GET /api/debates/similar?a=&b= | - | - | `{debate: DebateSummary \| null}` | - |
| GET /api/debates/{id} | - | - | DebateDetail(가려진 토론은 hidden=true, 개수 0) | 404 `not_found`, 422(id 16자 초과) |
| GET /api/debates/{id}/utterances?after=0 | - | - | `{items: Utterance[], status, total: 6}` | 404 |
| POST /api/debates/{id}/retry | - | - | `{status}` | 404, 409 `not_paused`, 503 `global_closed` |
| POST /api/debates/{id}/predictions | - | `{pick: "A"\|"B"}` | `{pick}` (이미 했으면 기존 값) | 400, 404 |
| GET /api/debates/{id}/predictions/me | - | - | `{pick: "A"\|"B"\|null}` | 400, 404 |
| POST /api/utterances/{id}/empathy | - | - | `{count, empathized: true}` | 400, 404 |
| GET /api/debates/{id}/result | - | - | Result | 404, 409 `not_finished` |
| POST /api/debates/{id}/judge/retry | - | - | Result | 404, 409 |
| POST /api/debates/{id}/reports | - | `{reason}` | `{reported: true, hidden}` | 400, 404 |
| GET /api/me/quota | 필요 | - | `{remaining, limit, reset_at}` | 401 |
| POST /api/debates | 필요 | `{topic_a, topic_b}` (각 2~30자) | 201 `{id}` | 401, 422 `topic_rejected`(+reason, suggestions), 429 `user_limit`(+reset_at), 503 `global_closed`, 502 `check_failed` |
| GET /api/auth/me | - | - | `{user: {id, nickname} \| null}` | - |
| GET /api/auth/providers | - | - | `{google, kakao, dev}` (bool) | - |
| GET /api/auth/{google\|kakao}/login?next= | - | - | 302 → 제공자 | 404 미설정 |
| GET /api/auth/{google\|kakao}/callback | - | code, state | 302 → next | 400 |
| POST /api/auth/dev-login | - | - | `{user}` | 404 (production) |
| POST /api/auth/logout | - | - | `{ok}` | - |
| GET /api/cron/today | Bearer CRON_SECRET | - | `{id}` | 401 |
| GET /share/{id} | - | - | OG 메타가 든 HTML → /debates/{id}로 이동 | 404 |
| GET /api/og/{id}.png | - | - | 1200×630 PNG(승자 없음) | 404 |

응답 타입
- 시간: `created_at`은 타임존 없는 UTC 문자열(프론트가 Z를 붙여 읽음), `today_date`는 한국 날짜 YYYY-MM-DD
- 배지: status가 done이면 "완료", 그 외(generating·paused)는 "진행 중"(Q-010)
- DebateSummary: `id, topic_a, topic_b, status("generating"|"paused"|"done"), prediction_count, created_at, today_date|null, cast: CastMember[]`
- CastMember: `character("cat"|"penguin"), side("A"|"B"), name, ai, catchphrase`
- DebateDetail: DebateSummary + `hidden: bool, utterance_count`
- Utterance: `id, seq, round, side, character, text, caption, empathy_count`
- Result: `judge_status("pending"|"done"|"failed"), winner|null, judge_reason|null, my_prediction|null, audience: {count, a_ratio|null, b_ratio|null}, metrics: {rebut_rate|null, agree_rate|null, human_agreement|null}`

최종 수정: 2026-11-22 · 관련: F-001~F-008
