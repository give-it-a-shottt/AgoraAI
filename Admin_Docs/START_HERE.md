# Agora AI 토론장

## 내가 할 일
- 배포 때 확인: AI 대리 작성 칸 검토 → 각 feature.md의 "(AI 대리 작성 — 사용자 위임)" 표시 칸
- 배포 때 확인: 내가 정할 질문 → OPEN_QUESTIONS.md "사용자" 줄

## 한눈에 보기
이 서비스는: 투표로 고른 밸런스 게임 주제를 귀여운 AI 캐릭터들이 한국어로 토론하고, 말 한마디의 핵심이 예능 자막처럼 튀어나오는 AI 토론장이다. 밸런스 게임을 즐기는 20~30대, 그리고 PC에서 로그인 없이 1~2분 보는 면접관을 위한 포트폴리오 서비스다. (AI 대리 작성 — 사용자 위임, 출처: agora-design.md 머리말·§0)
지금 상태: STATUS.md 맨 위 한 줄 참고

### 상황별 읽는 곳
| 언제 | 여기만 읽기 | 안 읽어도 되는 것 |
|---|---|---|
| 리뷰가 끝났을 때 | 그 기능의 review/SUMMARY.md — 맨 위 "내가 할 일"부터 "최종 판정"까지 | R1~R4.md, REVIEW_LOG.md, SUMMARY의 "개발자 상세" |
| 지금 어디까지 왔는지 | STATUS.md 맨 위 "내가 할 일"과 개수 한 줄 | 기능별 표는 궁금할 때만 |
| 기능을 시작할 때 | 그 기능의 feature.md 맨 위 "내가 할 일" | — |
| 결정할 게 쌓였을 때 | OPEN_QUESTIONS.md에서 "누가 정해야 하나 = 사용자"인 줄만 | "AI 확인" 질문 |
| 면접 전 | START_HERE.md → 기능별 feature.md의 "면접 예상 질문" | _system/ |
| 같은 문제로 또 막혔을 때 | troubleshooting/INDEX.md | — |

### 표시 범례
| 무엇에 붙나 | 표시 | 뜻 |
|---|---|---|
| 문서·리뷰 전체 상태 | [통과] | 지적이 없거나 [제안]만 있음 |
| | [보완] | [주의] 지적이 있음 |
| | [막힘] | [위험] 지적이 있음. 고치기 전엔 STATUS가 [됨]이 될 수 없음 |
| 지적 하나의 등급 | [위험] | 그대로 두면 잘못 동작하거나 보안 문제가 생김 |
| | [주의] | 지금은 돌아가지만 고치는 게 좋음 |
| | [제안] | 해도 되고 안 해도 됨 |
| 지적의 확신 | [확실] | 해당 코드를 직접 읽고 확인함 |
| | [추정] | 일부만 보고 판단함, 확인이 더 필요함 |
| 2차 이상 리뷰 | [신규] | 이번 회차에 새로 생긴 지적 |
| 기능 진행(STATUS) | [됨] / [일부] / [다음] | 확인까지 끝남 / 진행 중이거나 확인 방법 없음 / 시작 전 |
| 질문(OPEN_QUESTIONS) | [열림] / [닫힘] | 아직 답 없음 / 답이 다른 문서로 옮겨짐 |

### 폴더 역할
| 폴더·파일 | 답하는 질문 |
|---|---|
| STATUS.md | 지금 어디까지 왔고, 어떻게 확인했나 |
| OPEN_QUESTIONS.md | 아직 결정 못 한 게 뭔가 |
| overview | 지금 어떻게 생겼나 |
| decisions | 왜 이렇게 했나 |
| features | 무엇을 만들었고, 리뷰 결과는 어땠나 |
| troubleshooting | 뭐가 막혔고 어떻게 풀었나 |
| _system | 규칙·용어·리뷰어 기준 (참고용) |

## 개발자 상세
- 기술 스택: Vite + React 19 + TypeScript(프론트) · FastAPI + SQLAlchemy 2 + Alembic(백엔드) · Postgres(Neon, 배포) / SQLite(로컬) · Vercel Hobby
- AI: 토론자 A 냥냥이 = HyperCLOVA X, 토론자 B 펭펭이 = Gemini, 심판 부엉이 = Groq gpt-oss. 키가 없으면 mock 공급자
- 실행: `cd backend && uv run uvicorn app.main:app --reload` · `cd frontend && npm run dev` (자세한 건 README.md)
- 주요 결정: decisions/ 폴더 목록 참고 (D-001 기술 스택, D-002 키 없으면 mock, D-003 발언 1개 = 요청 1번 생성, D-004 로그인 방식)
- 기획·디자인 원본: 레포 루트 agora-design.md, Figma 파일(키는 agora-design.md에 없음, 화면 노드 ID는 overview/screens.md)
