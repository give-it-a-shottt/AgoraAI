export const TOPIC_MIN = 2
export const TOPIC_MAX = 30
const NO_ANGLES = /[<>＜＞〈〉《》‹›﹤﹥⟨⟩]/ // 서버 services/creation.py clean_topic과 같은 규칙

/** 선택지 한 칸 검사. 문제가 없으면 null, 있으면 보여 줄 문구. */
export function validateTopic(value: string): string | null {
  const v = value.trim()
  if (v.length < TOPIC_MIN || v.length > TOPIC_MAX) return `${TOPIC_MIN}~${TOPIC_MAX}자로 써 주세요`
  if (NO_ANGLES.test(v)) return '꺾쇠(< >) 같은 기호는 쓸 수 없어요'
  return null
}
