import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('4xx는 재시도 안 함', () => expect(shouldRetry(0, new ApiError(404, 'not_found', ''))).toBe(false))
  it('네트워크·5xx는 2번까지', () => {
    expect(shouldRetry(0, new ApiError(0, 'network', ''))).toBe(true)
    expect(shouldRetry(1, new ApiError(500, 'internal', ''))).toBe(true)
    expect(shouldRetry(2, new ApiError(500, 'internal', ''))).toBe(false)
  })
})
