export const TOPIC_MIN = 2
export const TOPIC_MAX = 30
// 입력 규칙은 서버 services/creation.py(TOPIC_MIN·TOPIC_MAX·_FORBIDDEN_CHARS)와 같다. 바꿀 때 양쪽을 같이 고친다.
const NO_ANGLES = /[<>＜＞〈〉《》‹›﹤﹥⟨⟩]/

/** 선택지 한 칸 검사. 문제가 없으면 null, 있으면 보여 줄 문구. */
export function validateTopic(value: string): string | null {
  const v = value.trim()
  if (v.length < TOPIC_MIN || v.length > TOPIC_MAX) return `${TOPIC_MIN}~${TOPIC_MAX}자로 써 주세요`
  if (NO_ANGLES.test(v)) return '꺾쇠(< >) 같은 기호는 쓸 수 없어요'
  return null
}
