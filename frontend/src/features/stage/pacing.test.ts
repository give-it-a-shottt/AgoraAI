import { describe, expect, it } from 'vitest'
import { autoAdvanceMs, HOLD_MAX_MS, HOLD_MIN_MS } from './pacing'

describe('autoAdvanceMs', () => {
  it('짧은 발언도 최소 3초는 기다린다', () => {
    expect(autoAdvanceMs('짧은 말')).toBe(HOLD_MIN_MS)
  })
  it('글자가 많을수록 오래 기다린다(평균 124자 ≈ 10초)', () => {
    expect(autoAdvanceMs('가'.repeat(124))).toBe(1500 + 124 * 70)
    expect(autoAdvanceMs('가'.repeat(150))).toBeGreaterThan(autoAdvanceMs('가'.repeat(100)))
  })
  it('아주 길어도 12초를 넘지 않는다', () => {
    expect(autoAdvanceMs('가'.repeat(300))).toBe(HOLD_MAX_MS)
  })
})
