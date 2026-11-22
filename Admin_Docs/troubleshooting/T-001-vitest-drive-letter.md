# T-001 Windows에서 Vitest가 "current suite를 못 찾음"으로 전부 실패

## 한눈에 보기 (코드 몰라도 OK)
무슨 문제였나: 프론트 테스트를 돌리면 테스트 파일 4개가 시작도 못 하고 모두 실패했다.
어떻게 해결했나: 경로의 드라이브 글자를 대문자(`C:/project/...`)로 해서 실행하면 된다. 소문자 `c:`로 실행하면 Vitest가 같은 파일을 두 번 읽어 헷갈린다.

## 개발자 상세
- 증상: `Error: Vitest failed to find the current suite` / `TypeError: Cannot read properties of undefined (reading 'config')`. 출력 첫 줄이 `RUN v… c:/project/AgoraAI/frontend`(소문자)일 때만 실패.
- 원인: 작업 디렉터리가 소문자 `c:\project\...`로 잡히면, Windows는 대소문자를 구분하지 않지만 Node 모듈 캐시는 문자열로 구분한다. 그래서 vitest 런타임이 두 벌 로드되어 테스트 파일이 다른 인스턴스의 `test()`를 부른다. Vitest 4·5 모두 같았다(버전 문제 아님).
- 해결: `cd "C:/project/AgoraAI/frontend" && npm test` (대문자 드라이브). VS Code 터미널·CI(리눅스)에서는 생기지 않는다.
- 재발 방지: README 테스트 안내에 대문자 경로 메모. 같은 증상이면 출력 첫 줄의 드라이브 글자부터 확인.
- 관련: F-000 (R2 지적으로 vitest 3 → 5 올리던 중 발견)

최종 수정: 2026-11-22
