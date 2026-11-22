import type { DebateSummary } from '../api/types'

export function debate(over: Partial<DebateSummary> = {}): DebateSummary {
  return {
    id: 'd1',
    topic_a: '평생 짜장',
    topic_b: '평생 짬뽕',
    status: 'done',
    prediction_count: 128,
    created_at: new Date().toISOString().replace('Z', ''),
    today_date: '2026-11-22',
    cast: [
      { character: 'penguin', side: 'B', name: '펭펭이', ai: 'Gemini', catchphrase: '팔짱 끼고 숫자부터 따져요' },
      { character: 'cat', side: 'A', name: '냥냥이', ai: 'HyperCLOVA X', catchphrase: '“근데 그거 아세요?”로 시작해요' },
    ],
    ...over,
  }
}
