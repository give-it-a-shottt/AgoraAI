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

export type Utterance = {
  id: number
  seq: number
  round: number
  side: Side
  character: CharacterKey
  text: string
  caption: string
  empathy_count: number
}

export type UtteranceList = { items: Utterance[]; status: DebateStatus; total: number }

export type Result = {
  judge_status: 'pending' | 'done' | 'failed'
  winner: Side | null
  judge_reason: string | null
  my_prediction: Side | null
  audience: { count: number; a_ratio: number | null; b_ratio: number | null }
  metrics: { rebut_rate: number | null; agree_rate: number | null; human_agreement: number | null }
}

/** DEB_01_006 신고 이유 */
export const REPORT_REASONS = [
  { key: 'hate', label: '혐오 · 차별 표현' },
  { key: 'person', label: '실존 인물을 비방해요' },
  { key: 'sexual', label: '성적인 내용' },
  { key: 'offtopic', label: '주제와 상관없는 말' },
  { key: 'other', label: '기타' },
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]['key']
