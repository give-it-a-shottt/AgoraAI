import { vi } from 'vitest'

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined

/** 경로별로 응답을 정하는 fetch 가짜. 처리 안 된 요청은 404 not_found. */
export function mockApi(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost')
    const r = handler(url, init) ?? { status: 404, body: { detail: { code: 'not_found', message: '없음' } } }
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
