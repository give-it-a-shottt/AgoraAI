import { describe, expect, it } from 'vitest'
import { parsePage } from './useHomeList'

describe('parsePage', () => {
  it.each([
    [null, 1],
    ['3', 3],
    ['0', 1],
    ['1.5', 1],
    ['abc', 1],
    ['5000', 1],
    ['1000', 1000],
  ])('%s → %i', (raw, expected) => expect(parsePage(raw)).toBe(expected))
})
