import type { CastMember, DebateSummary, Side } from '../../api/types'

export const topicOf = (d: Pick<DebateSummary, 'topic_a' | 'topic_b'>, side: Side) =>
  side === 'A' ? d.topic_a : d.topic_b

export const titleOf = (d: Pick<DebateSummary, 'topic_a' | 'topic_b'>) => `${d.topic_a} vs ${d.topic_b}`

/** 냥냥이 먼저(화면 순서 고정) */
export function castInOrder(d: DebateSummary): CastMember[] {
  return [...d.cast].sort((x, y) => Number(y.character === 'cat') - Number(x.character === 'cat'))
}

export function memberOf(d: DebateSummary, side: Side): CastMember {
  return d.cast.find((c) => c.side === side)!
}
