# T-003 운영 DB(Postgres)에서만 마이그레이션 실패 — 불리언 기본값 0

## 한눈에 보기
무슨 문제였나: 로컬(SQLite)에서는 잘 되던 표 만들기가 Neon(Postgres)에서 "boolean 칸에 정수 기본값"이라며 실패했다.
어떻게 해결했나: 마이그레이션의 불리언 기본값을 `sa.false()`로 고치고, Postgres용 SQL을 접속 없이 만들어 검사하는 테스트를 추가했다.

## 개발자 상세
- 증상: `alembic upgrade head`(Neon) → `psycopg.errors.DatatypeMismatch: column "is_hidden" is of type boolean but default expression is of type integer` (`is_hidden BOOLEAN DEFAULT 0`)
- 원인: 모델은 `server_default=false()`였지만, SQLite에 붙여 autogenerate한 마이그레이션이 `sa.text('0')`로 적었다. SQLite는 불리언을 정수로 저장해 통과했고, 테스트도 SQLite에서만 돌아 못 잡았다.
- 해결: `alembic/versions/d673ff9df19b_initial_schema.py`의 `is_hidden`·`is_seed`를 `sa.false()`로. (처음 일괄 치환이 정수 칸 `fail_count`까지 바꿔 한 번 더 실패 → 불리언 줄만 고침)
- 재발 방지: `tests/test_infra.py::test_migration_sql_is_valid_for_postgres` — `alembic upgrade head --sql`을 Postgres 방언으로 만들어 `BOOLEAN DEFAULT 0`·`INTEGER DEFAULT false`가 없는지 확인. 실패한 시도는 Postgres가 DDL을 트랜잭션으로 되돌려 표가 반쯤 남지 않았다.
- 함께 확인: 같은 접속으로 하루 사용량 자리 잡기를 스레드 10개로 동시에 호출(한도 3) → 정확히 3개 성공(F-007 2차 R2 제안의 운영 DB 확인).
- 관련: F-000(초기 스키마), F-007
