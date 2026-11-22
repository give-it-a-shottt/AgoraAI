/** 서버 응답 타입 — Admin_Docs/overview/api-list.md와 같아야 한다. 승자(winner)는 Result에만 있다. */
export const SIDES = ['A', 'B'] as const
export type Side = (typeof SIDES)[number]
export const isSide = (v: unknown): v is Side => v === 'A' || v === 'B'
export type DebateStatus = 'generating' | 'paused' | 'done'
export type CharacterKey = 'cat' | 'penguin'

export type CastMember = {
  character: CharacterKey
  side: Side
  name: string
  ai: string
  catchphrase: string
}

export type DebateSummary = {
  id: string
  topic_a: string
  topic_b: string
  status: DebateStatus
  prediction_count: number
  created_at: string
  today_date: string | null
  cast: CastMember[]
}

export type DebateList = {
  items: DebateSummary[]
  page: number
  total_pages: number
  total: number
}

export type DebateDetail = DebateSummary & { hidden: boolean; utterance_count: number }

export type SortKey = 'popular' | 'latest'
