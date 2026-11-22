/** 홈 "방금 만든 토론" 한 줄(§0-4) — 이 브라우저에서 만든 마지막 토론만 기억한다. */
const KEY = 'agora.recentDebate'

export type RecentDebate = { id: string; topic_a: string; topic_b: string }

export function saveRecentDebate(debate: RecentDebate): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(debate))
  } catch {
    /* 저장이 막혀도 기능에는 지장 없음 */
  }
}

export function loadRecentDebate(): RecentDebate | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<RecentDebate>
    return typeof v.id === 'string' && typeof v.topic_a === 'string' && typeof v.topic_b === 'string'
      ? (v as RecentDebate)
      : null
  } catch {
    return null
  }
}
