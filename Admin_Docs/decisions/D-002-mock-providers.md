# D-002 API 키가 없으면 가짜(mock) AI로 돌린다

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: HyperCLOVA X·Gemini·Groq 키가 환경변수에 없으면, 정해진 규칙으로 한국어 발언을 흉내 내는 가짜 AI가 대신 답한다.
비유: 배우가 아직 안 왔을 때 대역 배우로 리허설을 한다.
왜: 키 없이도 개발·테스트·화면 확인을 끝까지 할 수 있고, 테스트가 외부 서비스 상태에 흔들리지 않는다.

## 개발자 상세
- backend/app/providers/: base.py(공통 인터페이스) · mock.py · hyperclova.py · gemini.py · groq.py
- providers/__init__.py의 선택 함수가 키 유무로 진짜/가짜를 고른다. 키 이름: HYPERCLOVA_API_KEY, GEMINI_API_KEY, GROQ_API_KEY
- 대안: 키를 필수로 하고 테스트만 가짜로 → 로컬에서 화면 확인이 불가해서 기각.
- 제약: mock 발언은 진짜 토론 품질이 아니다. 시드 토론을 무엇으로 만들지는 Q-007.
- 바꿔야 하는 조건: 배포 환경에서는 키가 없을 때 mock으로 조용히 넘어가지 않게, 운영 모드(APP_ENV=production)에서는 mock 사용 시 경고 로그를 남긴다.

최종 수정: 2026-11-22 · 관련: F-002, Q-007
