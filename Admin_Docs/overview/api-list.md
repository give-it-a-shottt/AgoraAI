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
- 가려진 토론: 상세(GET /api/debates/{id})만 200 + `hidden: true`(화면이 DEB_01_008에 주제를 보여 주려고), 그 밖의 토론 안 API(발언·예측·공감·신고·재시도)는 410 `hidden`

| 메서드 · 경로 | 로그인 | 요청 | 응답(성공) | 에러 |
|---|---|---|---|---|
| GET /api/health | - | - | `{ok}` | - |
| GET /api/debates/today | - | - | DebateSummary — 고르는 규칙(Q-010): 오늘까지의 최근 오늘의 토론 → 최근 완료 → 최근 토론 | 404 `no_today`(토론이 하나도 없을 때만) |
| GET /api/debates?sort=popular\|latest&page=1&size=5 | - | - | `{items: DebateSummary[], page, total_pages, total}` — 오늘의 토론(맨 위 카드)은 목록·total에서 뺌. 마지막보다 큰 page는 빈 items | 422(page 1~1000, size 1~20 밖) |
| GET /api/debates/similar?a=&b= | - | - | `{debate: DebateSummary \| null}` | - |
| GET /api/debates/{id} | - | - | DebateDetail(가려진 토론은 hidden=true, 개수 0) | 404 `not_found`, 422(id 16자 초과) |
| GET /api/debates/{id}/utterances?after=0 | - | - | `{items: Utterance[], status, total: 6}` — after보다 큰 순번만. 생성 중인데 20초 넘게 새 발언·잠금이 없으면 서버가 다시 깨움(paused는 안 깨움) | 404, 410 `hidden`, 422(after 0~6 밖, id 16자 초과) |
| POST /api/debates/{id}/retry | - | - | `{status}` (generating으로 바뀌고 백그라운드로 이어서 생성) | 404, 410 `hidden`, 409 `not_paused`·`retry_limit`(토론당 3번), 429 `retry_too_soon`(+retry_after 초, 멈춘 뒤 60초) | (전체 하루 마감에는 막지 않음 — 위 횟수·대기로 따로 막음)
| POST /api/debates/{id}/predictions | - | `{pick: "A"\|"B"}` | `{pick}` (이미 했으면 처음 값) | 400 `browser_id_required`, 404, 410 `hidden`, 422, 429 `too_many_requests`(+retry_after, 접속자당 10분 30개) |
| GET /api/debates/{id}/predictions/me | - | - | `{pick: "A"\|"B"\|null}` | 400 `browser_id_required`, 404, 410 `hidden` |
| POST /api/utterances/{id}/empathy | - | - | `{count, empathized: true}` (이미 했으면 그대로) | 400 `browser_id_required`, 404, 410 `hidden`, 422, 429 `too_many_requests`(접속자당 10분 60개) |
| GET /api/debates/{id}/result | - | - | Result — 승자·이유·지표는 judge_status=done일 때만. X-Browser-Id가 없거나 틀려도 볼 수 있음(내 예측만 null) | 404, 409 `not_finished`, 410 `hidden` |
| POST /api/debates/{id}/judge/retry | - | - | Result(judge_status=pending으로 바로 돌려주고 판정은 백그라운드 — 화면은 결과를 다시 읽음) | 400, 404, 410, 409 `not_finished`·`not_failed`·`judge_limit`(토론당 판정 시도 4번) |
| POST /api/debates/{id}/reports | - | `{reason: "hate"\|"person"\|"sexual"\|"offtopic"\|"other"}` | `{reported: true, hidden}` (브라우저당 1번, 서로 다른 접속자 3곳이면 hidden — Q-013) | 400, 404, 410, 422, 429 `too_many_requests`(접속자당 1시간 10건) |
| GET /api/me/quota | 필요 | - | `{remaining, limit, reset_at}` (reset_at: 한국 다음 날 0시, 다른 시간 값처럼 타임존 없는 UTC — 프론트는 Z를 붙여 읽음) | 401 |
| POST /api/debates | 필요 | `{topic_a, topic_b}` (각 2~30자) | 201 `{id}` (주제 확인 통과 후 생성, 발언은 백그라운드) | 401, 422 `topic_invalid`(길이·꺾쇠 기호) · `topic_rejected`(message에 이유, suggestions: `[{a, b}]`), 429 `user_limit`(+reset_at) · `check_limit`(+reset_at, 사람당 하루 AI 확인 횟수 — 거절돼도 셈), 503 `global_closed`(전체 만들기 또는 전체 AI 확인 횟수 소진), 502 `check_failed`. 본문이 200자를 넘는 등 형식 오류는 FastAPI 기본 422(detail 배열 — 화면은 "입력한 내용을 다시 확인해 주세요") |
| GET /api/auth/me | - | - | `{user: {id, nickname} \| null}` | - |
| GET /api/auth/providers | - | - | `{google, kakao, dev}` (bool) | - |
| GET /api/auth/{google\|kakao}/login?next= | - | - | 302 → 제공자 | 404 미설정 |
| GET /api/auth/{google\|kakao}/callback | - | code, state | 302 → next(세션 쿠키 설정) | 실패(state 불일치·동의 취소·제공자 오류)는 302 → `/?login=failed`(화면이 토스트로 안내) |
| POST /api/auth/dev-login | - | - | `{user}` | 404 (production) |
| POST /api/auth/logout | - | - | `{ok}` (세션 버전을 올려 이 사용자의 모든 기기 쿠키를 무효로) | - |
| GET /api/cron/today | `Authorization: Bearer CRON_SECRET`(Vercel Cron) | - | `{debate_id, source, created}` — debate_id는 문자열 또는 null, source는 existing·pool·promoted 또는 null (하루 한 번만 지정, 새로 만들면 생성은 백그라운드) | 401 `unauthorized`, 503 `cron_not_configured`(비밀값 없음) |
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
