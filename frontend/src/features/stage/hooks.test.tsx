import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoAdvance, useWaitElapsed } from './hooks'

afterEach(() => vi.useRealTimers())

describe('useWaitElapsed (대기 30초·60초 안내의 시계)', () => {
  it('기다리는 동안 초가 늘고, 멈추면 0, reset이면 다시 0부터', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ waiting }) => useWaitElapsed(waiting), { initialProps: { waiting: true } })
    act(() => vi.advanceTimersByTime(31_000))
    expect(result.current.elapsed).toBeGreaterThanOrEqual(30)
    act(() => result.current.reset())
    expect(result.current.elapsed).toBe(0)
    act(() => vi.advanceTimersByTime(61_000))
    expect(result.current.elapsed).toBeGreaterThanOrEqual(60)
    rerender({ waiting: false })
    expect(result.current.elapsed).toBe(0)
  })
})

describe('useAutoAdvance', () => {
  it('켜져 있으면 delay 뒤 한 번, 꺼지면 부르지 않는다', () => {
    vi.useFakeTimers()
    const advance = vi.fn()
    const { rerender } = renderHook(({ on, step }) => useAutoAdvance(on, 2500, advance, step), { initialProps: { on: true, step: 0 } })
    act(() => vi.advanceTimersByTime(2499))
    expect(advance).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(advance).toHaveBeenCalledTimes(1)
    rerender({ on: false, step: 1 })
    act(() => vi.advanceTimersByTime(5000))
    expect(advance).toHaveBeenCalledTimes(1)
  })
})
