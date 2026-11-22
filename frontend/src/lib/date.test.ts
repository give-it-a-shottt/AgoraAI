import { describe, expect, it } from 'vitest'
import { monthDay, relativeDay } from './date'

describe('relativeDay', () => {
  const now = new Date('2026-11-22T03:00:00Z') // KST 12:00
  it('같은 한국 날짜면 오늘', () => expect(relativeDay('2026-11-21T16:00:00', now)).toBe('오늘'))
  it('하루 전은 어제', () => expect(relativeDay('2026-11-21T03:00:00', now)).toBe('어제'))
  it('그 전은 N일 전', () => expect(relativeDay('2026-11-19T03:00:00', now)).toBe('3일 전'))
})

describe('monthDay', () => {
  it('ISO 날짜를 한국식으로', () => expect(monthDay('2026-11-22')).toBe('11월 22일'))
})
