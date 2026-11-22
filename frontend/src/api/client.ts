import { getBrowserId } from '../lib/browserId'

/** 서버 에러 모양 {"detail": {"code", "message", ...}} 을 담는 에러. 네트워크 실패는 status 0. */
export class ApiError extends Error {
  status: number
  code: string
  extra: Record<string, unknown>

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }

  get isNetwork() {
    return this.status === 0
  }
}

const DEFAULT_MESSAGE = '잠시 후 다시 시도해 주세요.'

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Browser-Id', getBrowserId())
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(path, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'network', '인터넷 연결이 잠시 끊겼어요.')
  }

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body?.detail
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const { code, message, ...extra } = detail as Record<string, unknown>
      throw new ApiError(res.status, String(code ?? 'error'), String(message ?? DEFAULT_MESSAGE), extra)
    }
    throw new ApiError(res.status, res.status === 422 ? 'validation' : 'error', DEFAULT_MESSAGE)
  }
  // 성공인데 JSON이 아니면(프록시·배포 설정 오류로 index.html이 온 경우 등) 에러로 본다.
  if (body === null) throw new ApiError(res.status, 'invalid_response', DEFAULT_MESSAGE)
  return body as T
}

export const post = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) })
