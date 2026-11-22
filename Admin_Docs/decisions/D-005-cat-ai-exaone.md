# D-005 냥냥이 AI를 HyperCLOVA X 대신 EXAONE으로(막히면 다음 공급자로)

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 냥냥이(A편 토론자)는 키가 있는 공급자를 HyperCLOVA X → EXAONE(키 1·2) → Groq Qwen 순서로 쓴다. 앞이 하루 한도·오류로 막히면 그 발언만 다음 공급자가 대신 만든다. 펭펭이는 Gemini, 심판은 Groq gpt-oss. 화면의 "냥냥이 · ○○"는 지금 1순위로 쓰는 AI 이름을 보여 준다.
비유: 주연 배우가 못 나오면 정해 둔 순서대로 대역이 무대에 선다. 공연은 멈추지 않는다.
왜: 사용자가 HyperCLOVA X(유료·가입 절차)보다 이미 가진 EXAONE 키를 쓰기로 했다(2026-11-22, 사용자 결정). EXAONE도 한국 AI라 "한국 AI vs 글로벌 AI" 기획이 그대로 살아 있다.

## 개발자 상세
- 상황: 배포 중 실제 키를 붙이며 후보를 직접 호출해 비교(2026-11-22, 냥냥이 말투 한국어 2문장 기준).

| 후보 | 속도 | 한국어 | 결과 |
|---|---|---|---|
| EXAONE `k-exaone_v2.5`(reasoning_effort=low) | 7~8초 | 가장 자연스러움 | 채택(1순위) |
| Groq `qwen/qwen3.8-27b` | 0.8초 | 보통 이상 | 채택(대체) |
| NVIDIA `mistral-large-4` · `glm-5.3-flash` | 70~83초(생각을 끌 수 없음) | 좋음 | 기각 — 함수 60초 제한 |
| NVIDIA `nemotron-3.5-lightning` · `minimax-m3.1-flash` | 1.6~7초 | 맞춤법·어색함 | 기각 |
| HyperCLOVA X `HCX-005` | 미측정 | - | 키가 생기면 자동으로 1순위 |

- 구현: `providers/real.py`의 `OpenAICompatDebater`(EXAONE·Groq 공통, 생각 내용은 버리고 content만, 빈 content는 실패로) · `FallbackDebater`(ProviderError면 다음 공급자) · `providers/__init__.py`의 `_cat_chain`·`ai_label`.
- EXAONE 한도: 키마다 초당 1·분당 60·**하루 100회**(응답 헤더로 확인). 키 2개는 한도가 따로라 하루 약 200회. 냥냥이는 토론당 3번 말하므로 우리 쪽 하루 상한(사용자 20 + 오늘의 토론 1)이면 약 63회.
- Gemini: `gemini-2.5-flash`가 새 사용자에게 닫혀 `gemini-flash-lite-latest`(1.9초)로. 구형 종료에 덜 흔들리게 "-latest" 별칭을 쓴다.
- 실측: 실제 AI로 토론 1판(6발언 + 판정) 90초, 상태 done·판정 done.
- 제약: 화면 이름은 "지금 설정의 1순위"라, 키를 바꾸기 전에 만든 토론(시드 mock 포함)도 새 이름으로 보인다. 대체 공급자가 대신 말한 발언도 이름은 1순위로 보인다.
- 바꿔야 하는 조건: EXAONE 무료 한도·약관이 바뀌거나, HyperCLOVA X 키를 넣기로 할 때(넣기만 하면 자동 1순위).
- 관련: D-002(키 없으면 mock), D-003(발언 1개 = 요청 1번), F-002
