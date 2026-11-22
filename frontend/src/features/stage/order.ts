import type { Side } from '../../api/types'

/** 발언 순서 규칙(서버 generation.plan과 같음): 3라운드 × 2명, 라운드마다 A 편 → B 편.
 * 서버가 주는 round·side를 쓰되, 아직 오지 않은 "다음 발언"을 미리 안내할 때만 이 규칙으로 계산한다. */
export const UTTERANCES_PER_ROUND = 2

export const speakerOf = (seq: number): Side => (seq % UTTERANCES_PER_ROUND === 1 ? 'A' : 'B')
export const roundOf = (seq: number): number => Math.ceil(seq / UTTERANCES_PER_ROUND)
export const completedRounds = (count: number): number => Math.floor(count / UTTERANCES_PER_ROUND)
