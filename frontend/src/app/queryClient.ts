import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'

const MAX_RETRY = 2

/** 4xx는 다시 보내도 같은 답이라 재시도하지 않고, 네트워크·5xx만 최대 2번 재시도한다. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500
  return !isClientError && failureCount < MAX_RETRY
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: shouldRetry },
    mutations: { retry: false },
  },
})
