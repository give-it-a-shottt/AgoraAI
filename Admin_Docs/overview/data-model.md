# 데이터 모델

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 토론(debates) 하나에 발언(utterances) 6개가 달린다. 예측·공감·신고는 브라우저 번호로 한 번씩만 저장된다. 로그인한 사람(users)만 토론을 만들고, 하루 몇 번 만들었는지는 하루 사용량 칸(daily_usage)에 자리를 먼저 잡아 센다.
비유: 토론은 공연 한 편, 발언은 장면, 예측·공감·신고는 관객 표.
왜: 같은 장면이 두 번 저장되거나, 한 관객이 표를 여러 번 내지 못하게 DB가 직접 막게 하려고.

## 개발자 상세
| 테이블 | 주요 칸 | 제약 |
|---|---|---|
| users | id, provider(google/kakao/dev), provider_user_id, nickname, session_version(로그아웃하면 +1 → 이전 쿠키 무효), created_at | UNIQUE(provider, provider_user_id) |
| daily_usage | scope(create:user:{id} · create:global · check:user:{id} · check:global), day(한국 날짜), used | PK(scope, day) — 한도 안에서만 +1 하는 UPDATE 한 문장으로 자리를 잡는다(동시 요청에도 초과 없음) |
| debates | id(문자열 짧은 ID), topic_a, topic_b, normalized_key, cat_side(A/B), status(generating/paused/done), lock_until, fail_count, retry_count, paused_at, winner(A/B, 결과 API에서만 노출), judge_reason, judge_status(pending/done/failed), judge_attempts, rebut_rate, agree_rate, is_hidden, today_date, is_seed, creator_id→users, created_at | INDEX(normalized_key), INDEX(today_date), INDEX(created_at), INDEX(creator_id) |
| utterances | id, debate_id→debates, seq(1~6), round(1~3), side(A/B), text, caption, stance_label(rebut/agree/neutral, 심판이 붙임), created_at | UNIQUE(debate_id, seq) |
| predictions | id, debate_id, browser_id, pick(A/B), client_hash, created_at | UNIQUE(debate_id, browser_id), INDEX(client_hash, created_at) |
| empathies | id, utterance_id, browser_id, client_hash, created_at | UNIQUE(utterance_id, browser_id), INDEX(client_hash, created_at) |
| reports | id, debate_id, browser_id, reason, client_hash, created_at | UNIQUE(debate_id, browser_id), INDEX(client_hash, created_at) |
- 발언 순서: 라운드마다 A 편 → B 편. seq = (round-1)*2 + (A면 1, B면 2).
- 개인 하루 한도: debates에서 creator_id·오늘 생성 건수를 센다(검수 거절·실패는 토론이 안 만들어지므로 자동으로 차감 없음).
- 기본값: status·judge_status·fail_count·is_hidden·is_seed·nickname은 DB 기본값(server_default)도 있어 ORM 밖 INSERT도 안전.
- 예측·공감·신고의 토론/발언 번호 칸은 UNIQUE의 앞 칸이라 별도 인덱스를 두지 않는다(UNIQUE가 대신함).
- client_hash: 접속 주소(IP)에 서버 비밀값을 섞은 해시 앞 32자. 요청 수 제한에만 쓰고 IP 원문은 저장하지 않는다.
- 숨김: 서로 다른 접속자(client_hash) 3곳이 신고하면 is_hidden=true(Q-013). 되돌리기는 `uv run python -m app.jobs.unhide <토론ID> [--clear-reports]`(관리 화면 없음).

최종 수정: 2026-11-22 · 관련: D-003, F-002, F-005
