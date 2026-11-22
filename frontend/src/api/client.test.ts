import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => vi.unstubAllGlobals())

describe('api()', () => {
  it('성공 JSON을 돌려주고 X-Browser-Id를 붙인다', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await expect(api('/api/health')).resolves.toEqual({ ok: true })
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('X-Browser-Id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(init.credentials).toBe('include')
  })

  it('서버 에러 모양을 ApiError(code, message, extra)로 바꾼다', async () => {
    const body = { detail: { code: 'user_limit', message: '오늘은 다 만들었어요', reset_at: 'x' } }
    mockFetch(async () => new Response(JSON.stringify(body), { status: 429 }))
    const err = (await api("/x").catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 429, code: 'user_limit', message: '오늘은 다 만들었어요' })
    expect(err.extra).toEqual({ reset_at: 'x' })
  })

  it('422 기본 모양은 validation 코드와 기본 문구', async () => {
    mockFetch(async () => new Response(JSON.stringify({ detail: [{ msg: 'bad' }] }), { status: 422 }))
    await expect(api('/x')).rejects.toMatchObject({ status: 422, code: 'validation' })
  })

  it('네트워크 실패는 status 0', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const err = (await api("/x").catch((e: unknown) => e)) as ApiError
    expect(err.isNetwork).toBe(true)
  })

  it('204는 undefined', async () => {
    mockFetch(async () => new Response(null, { status: 204 }))
    await expect(api('/x')).resolves.toBeUndefined()
  })

  it('성공인데 JSON이 아니면 에러', async () => {
    mockFetch(async () => new Response('<!doctype html>', { status: 200 }))
    await expect(api('/x')).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
