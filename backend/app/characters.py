"""출연 캐릭터 정보(agora-design.md §0-4, Figma 승부 예측 화면). 편(A/B)만 토론마다 무작위.
"ai"는 키가 없을 때(mock) 보이는 기본 이름 — 실제 화면 이름은 providers.ai_label이 쓰는 공급자로 정한다(D-005)."""

CHARACTERS = {
    "cat": {"name": "냥냥이", "ai": "EXAONE", "catchphrase": "“근데 그거 아세요?”로 시작해요"},
    "penguin": {"name": "펭펭이", "ai": "Gemini", "catchphrase": "팔짱 끼고 숫자부터 따져요"},
}
JUDGE = {"name": "부엉이", "ai": "Groq gpt-oss"}
