# D-001 기술 스택: Vite React + FastAPI + Postgres, Vercel

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 화면은 Vite(React), 서버는 FastAPI(파이썬), 저장소는 Postgres(Neon), 올리는 곳은 Vercel 무료 요금제.
비유: 가게 앞 진열대(화면)와 주방(서버)을 따로 두고, 창고(DB)는 바깥 임대 창고를 쓴다.
왜: agora-design.md §0-1에서 정한 스택. 1인·6~7주·무료 한도 안에서 운영하기 위해.

## 개발자 상세
- 출처: agora-design.md §0-1 "기술", §8 개발 전달 메모
- 로컬은 SQLite 파일 DB로 돌리고, 배포는 환경변수 DATABASE_URL(Neon Postgres)로 바꾼다. SQLAlchemy가 둘 다 지원.
- 후보 비교
| 후보 | 장점 | 단점 |
|---|---|---|
| Vite SPA + FastAPI (선택) | 화면·서버 분리가 명확, 파이썬 AI SDK 쓰기 쉬움 | SPA라 공유 미리보기를 서버가 따로 만들어야 함 |
| Next.js 하나로 | SSR로 OG 쉬움 | 파이썬 AI 코드와 분리됨, 설계 문서와 다름 |
- 제약: Vercel 서버리스 함수는 실행 시간이 짧다 → D-003의 "발언 1개 = 요청 1번"과 이어짐.
- 바꿔야 하는 조건: 생성 시간이 함수 제한을 자주 넘거나 무료 한도를 넘을 때.

최종 수정: 2026-11-22 · 관련: F-000, D-003
