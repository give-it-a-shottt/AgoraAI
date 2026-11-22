/** 이 브라우저에서 토론별로 "예측했는지/건너뛰었는지"를 기억한다.
 * GNB [결과 바로 보기]는 예측 또는 건너뛰기 뒤에만 보인다(§0-5 Flow B). 서버 예측값과 별개로 화면 흐름용. */
import type { Side } from '../api/types'

const KEY = 'agora.viewState'

export type ViewChoice = Side | 'skip'

function readAll(): Record<string, ViewChoice> {
  try {
    const raw = localStorage.getItem(KEY)
    const value: unknown = raw ? JSON.parse(raw) : {}
    return value && typeof value === 'object' ? (value as Record<string, ViewChoice>) : {}
  } catch {
    return {}
  }
}

export function getViewChoice(debateId: string): ViewChoice | null {
  const v = readAll()[debateId]
  return v === 'A' || v === 'B' || v === 'skip' ? v : null
}

export function setViewChoice(debateId: string, choice: ViewChoice): void {
  try {
    const all = readAll()
    // 예측이 건너뛰기를 덮어쓸 수는 있지만, 한 번 한 예측은 바꾸지 않는다(서버도 첫 예측만 인정).
    if (all[debateId] === 'A' || all[debateId] === 'B') return
    all[debateId] = choice
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 저장이 막혀도 관람은 계속 */
  }
}
