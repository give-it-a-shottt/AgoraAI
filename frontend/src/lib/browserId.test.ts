import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  localStorage.clear()
})

describe('getBrowserId', () => {
  it('한 번 만든 번호를 계속 쓴다', async () => {
    const { getBrowserId } = await import('./browserId')
    const id = getBrowserId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(getBrowserId()).toBe(id)
  })

  it('localStorage가 막혀도 같은 탭에서는 같은 번호', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { getBrowserId } = await import('./browserId')
    const id = getBrowserId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(getBrowserId()).toBe(id)
  })
})
