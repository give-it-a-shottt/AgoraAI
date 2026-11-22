# 배포 가이드 (Vercel + Neon)

프론트(Vite 빌드 결과)와 백엔드(FastAPI 파이썬 함수 `api/index.py`)를 Vercel 프로젝트 하나로 올립니다. DB는 Neon Postgres를 씁니다. 설정은 `vercel.json`에 이미 있습니다(빌드, `/api/*`·`/share/*` → 함수, 그 밖 → `index.html`, 매일 한국 0시 cron).

## 1. Vercel 프로젝트 만들기
1. Vercel → Add New → Project → GitHub 저장소 Import. 프로젝트 이름은 `agora-ai`(주소가 `https://agora-ai.vercel.app`이 됨 — 다르면 아래 PUBLIC_BASE_URL도 그 주소로), Framework Preset은 "Other", 루트는 그대로.
2. Environment Variables에 아래 값을 넣고 Deploy. 첫 배포는 DB가 아직 없어 `/api`가 500이어도 정상(다음 단계에서 연결).

## 2. Neon DB 연결 (Vercel 안에서)
Neon 계정이 Vercel과 연결돼 있으면 Neon 화면에서는 새 프로젝트를 만들 수 없고 Vercel에서 만든다.
1. Vercel 프로젝트 → Storage → Create Database → Neon(Postgres) → 리전 **Singapore (aws-ap-southeast-1)** — `vercel.json`의 함수 리전 `sin1`과 맞춤.
2. 프로젝트에 연결(Production 체크)하면 `DATABASE_URL` 등이 환경변수에 자동으로 들어간다.
3. 표 만들기(한 번): Vercel 환경변수(또는 Neon 대시보드)의 `DATABASE_URL` 값을 로컬 `backend/.env.neon`에 `DATABASE_URL=...` 한 줄로 저장(커밋 안 됨) 후
   ```bash
   cd backend
   export $(cat .env.neon) && uv run alembic upgrade head
   uv run python -m app.jobs.seed   # (선택) 시드 토론 18개, 기본 mock 대본(Q-007)
   ```
4. Vercel → Deployments → 최신 배포 → Redeploy(환경변수 반영).

### 환경변수
| 이름 | 값 | 필수 |
|---|---|---|
| `APP_ENV` | `production` | 필수 |
| `DATABASE_URL` | Neon 연결 시 자동 | 필수 |
| `SESSION_SECRET` | 32자 이상 무작위 문자열(예: `python -c "import secrets;print(secrets.token_urlsafe(48))"`) | 필수 |
| `CRON_SECRET` | 무작위 문자열(Vercel이 cron 호출에 자동으로 붙임) | 필수 |
| `PUBLIC_BASE_URL` | `https://<배포 도메인>` | 필수 |
| `FRONTEND_ORIGIN` | `https://<배포 도메인>` | 권장(CORS 허용 주소, 같은 도메인이라 없어도 동작) |
| `TRUST_PROXY` | `true` | 필수 |
| `GROQ_API_KEY` | 심판·주제 확인, 냥냥이 대체(Qwen) | 없으면 mock |
| `EXAONE_API_KEY`, `EXAONE_API_KEY_2` | 냥냥이(D-005, 키마다 하루 100회) | 없으면 Groq Qwen → mock |
| `GEMINI_API_KEY` | 펭펭이 | 없으면 mock |
| `HYPERCLOVA_API_KEY` | 냥냥이 1순위(선택) | 없으면 EXAONE |
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
