/** 다시보기 자동 진행: 자막이 뜬 뒤 다음 발언까지 기다리는 시간.
 * 타자 효과(글자당 20ms)는 읽는 속도보다 훨씬 빨라서, 고정 2.5초면 긴 발언(190자)은 다 읽기 전에 넘어갔다.
 * 한국어를 편하게 읽는 속도(초당 약 9~10자)에 맞춰 글자 수만큼 더 기다리고, 너무 짧거나 길지 않게 3~12초로 묶는다. */
export const HOLD_BASE_MS = 1500
export const HOLD_MS_PER_CHAR = 70
export const HOLD_MIN_MS = 3000
export const HOLD_MAX_MS = 12000

export function autoAdvanceMs(text: string): number {
  return Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, HOLD_BASE_MS + text.length * HOLD_MS_PER_CHAR))
}
