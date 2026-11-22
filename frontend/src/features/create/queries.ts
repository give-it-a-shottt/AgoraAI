import { useMutation, useQuery } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import type { DebateSummary } from '../../api/types'

export type Quota = { remaining: number; limit: number; reset_at: string }

export function useQuota(enabled: boolean) {
  return useQuery({ queryKey: ['me', 'quota'], queryFn: () => api<Quota>('/api/me/quota'), enabled })
}

/** 입력 중 "비슷한 토론이 있어요"(순서·띄어쓰기만 다른 같은 주제) */
export function useSimilar(a: string, b: string) {
  const ready = a.trim().length >= 2 && b.trim().length >= 2
  return useQuery({
    queryKey: ['debates', 'similar', a.trim(), b.trim()],
    queryFn: () =>
      api<{ debate: DebateSummary | null }>(
        `/api/debates/similar?a=${encodeURIComponent(a.trim())}&b=${encodeURIComponent(b.trim())}`,
      ),
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useCreateDebate() {
  return useMutation({
    mutationFn: (body: { topic_a: string; topic_b: string }) => post<{ id: string }>('/api/debates', body),
  })
}
