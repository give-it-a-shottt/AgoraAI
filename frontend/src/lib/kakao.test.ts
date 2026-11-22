import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  delete window.Kakao
  document.head.querySelectorAll('script').forEach((s) => s.remove())
})

describe('shareToKakao', () => {
  it('키가 없으면 false(링크 복사로 대신)', async () => {
    vi.stubEnv('VITE_KAKAO_JS_KEY', '')
    const { shareToKakao, kakaoAvailable } = await import('./kakao')
    expect(kakaoAvailable()).toBe(false)
    expect(await shareToKakao({ title: 't', description: 'd', imageUrl: 'i', url: 'u' })).toBe(false)
  })

  it('SDK가 있으면 초기화 후 공유 창, SRI 값으로 스크립트를 넣는다', async () => {
    vi.stubEnv('VITE_KAKAO_JS_KEY', 'js-key')
    const sendDefault = vi.fn()
    window.Kakao = { isInitialized: () => false, init: vi.fn(), Share: { sendDefault } }
    const { shareToKakao } = await import('./kakao')
    expect(await shareToKakao({ title: '산 vs 바다', description: 'd', imageUrl: 'i', url: 'u' })).toBe(true)
    expect(window.Kakao.init).toHaveBeenCalledWith('js-key')
    expect(sendDefault.mock.calls[0][0].content.title).toBe('산 vs 바다')
  })

  it('SDK 로드가 실패하면 false', async () => {
    vi.stubEnv('VITE_KAKAO_JS_KEY', 'js-key')
    const { shareToKakao } = await import('./kakao')
    const pending = shareToKakao({ title: 't', description: 'd', imageUrl: 'i', url: 'u' })
    const script = document.head.querySelector('script')!
    expect(script.integrity).toMatch(/^sha384-/)
    script.dispatchEvent(new Event('error'))
    expect(await pending).toBe(false)
  })
})
