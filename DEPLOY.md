# 배포 가이드 (Vercel + Neon)

프론트(Vite 빌드 결과)와 백엔드(FastAPI 파이썬 함수 `api/index.py`)를 Vercel 프로젝트 하나로 올립니다. DB는 Neon Postgres를 씁니다. 설정은 `vercel.json`에 이미 있습니다(빌드, `/api/*`·`/share/*` → 함수, 그 밖 → `index.html`, 매일 한국 0시 cron).

## 1. Neon DB 만들기 → 표 만들기
1. Neon에서 프로젝트를 만들고(리전: AWS Asia Pacific (Singapore) — `vercel.json`의 함수 리전 `sin1`과 맞춤) 연결 문자열(Postgres URL)을 복사합니다.
2. 내 컴퓨터에서 한 번 마이그레이션을 돌립니다.
   ```bash
   cd backend
   DATABASE_URL="<Neon 연결 문자열>" uv run alembic upgrade head
   ```
   PowerShell에서는 `$env:DATABASE_URL="<Neon 연결 문자열>"; uv run alembic upgrade head`
3. (선택) 시드 토론 18개 넣기: 같은 방식으로 `uv run python -m app.jobs.seed`. 기본은 mock 대본이고, `--real`을 붙이면 실제 AI로 만듭니다(Q-007).

## 2. Vercel 프로젝트 연결
1. Vercel에서 GitHub 저장소를 Import합니다. Framework Preset은 "Other", 루트는 저장소 루트 그대로 둡니다.
2. 환경변수를 **Production** 범위에 넣습니다.

| 이름 | 값 | 필수 |
|---|---|---|
| `APP_ENV` | `production` | 필수 |
| `DATABASE_URL` | Neon 연결 문자열 | 필수 |
| `SESSION_SECRET` | 32자 이상 무작위 문자열(예: `python -c "import secrets;print(secrets.token_urlsafe(48))"`) | 필수 |
| `CRON_SECRET` | 무작위 문자열(Vercel이 cron 호출에 자동으로 붙임) | 필수 |
| `PUBLIC_BASE_URL` | `https://<배포 도메인>` | 필수 |
| `FRONTEND_ORIGIN` | `https://<배포 도메인>` | 권장(CORS 허용 주소, 같은 도메인이라 없어도 동작) |
| `TRUST_PROXY` | `true` | 필수 |
| `GROQ_API_KEY` | 심판·주제 확인 | 없으면 mock |
| `HYPERCLOVA_API_KEY` | 냥냥이 | 없으면 mock |
| `GEMINI_API_KEY` | 펭펭이 | 없으면 mock |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 구글 로그인 | 없으면 버튼 없음 |
| `KAKAO_REST_KEY`, `KAKAO_CLIENT_SECRET` | 카카오 로그인 | 없으면 버튼 없음 |
| `VITE_KAKAO_JS_KEY` | 카카오톡 공유(Q-014) | 없으면 링크 복사 |
| `DAILY_USER_LIMIT` · `DAILY_GLOBAL_LIMIT` · `DAILY_USER_CHECKS` · `DAILY_GLOBAL_CHECKS` | 한도(Q-001·Q-002·Q-017) | 기본 3·20·10·100 |

⚠️ 필수 값이 빠지면 서버가 일부러 뜨지 않습니다(운영 안전장치). `/api/health`가 500이면 함수 로그에서 "운영 환경 설정이 빠졌어요"를 확인하세요.
⚠️ **Preview** 범위에는 운영 값을 복사하지 마세요. Preview를 쓰려면 다른 `SESSION_SECRET`과 별도 DB(Neon branch)를 넣습니다.

## 3. 소셜 로그인 콘솔 설정
- 구글(Google Cloud Console → OAuth 클라이언트): 승인된 리디렉션 URI `https://<배포 도메인>/api/auth/google/callback`
- 카카오(카카오 developers → 카카오 로그인): Redirect URI `https://<배포 도메인>/api/auth/kakao/callback`, 동의 항목은 닉네임만. 카카오톡 공유를 쓰면 플랫폼 → Web 사이트 도메인에 배포 도메인 등록

## 4. 배포 후 확인
1. `https://<도메인>/api/health` → `{"ok":true}`
2. 홈 → 승부 예측 → 무대 → 결과 → 공유 시트가 이어지는지
3. 로그인 → 토론 만들기 → 승부 예측 화면으로 가는지
4. 공유 링크를 카카오톡에 붙여 미리보기(제목·이미지)가 뜨는지
5. Vercel → Settings → Cron Jobs에 `/api/cron/today`가 보이는지(다음 날 0시에 오늘의 토론이 바뀜). 바로 확인하려면 Cron Jobs 화면의 "Run"
6. 동시 요청 한도(선택): 운영 DB에서 같은 계정으로 만들기를 동시에 여러 번 보내 하루 한도를 넘지 않는지(로컬 테스트는 SQLite에서만 돌았음)
