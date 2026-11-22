import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import type { DebateSummary } from '../../api/types'
import { quotaKey } from '../auth/authContext'
import { TOPIC_MIN } from './validate'

export type Quota = { remaining: number; limit: number; reset_at: string }

export function useQuota(enabled: boolean) {
  return useQuery({ queryKey: quotaKey, queryFn: () => api<Quota>('/api/me/quota'), enabled })
}

const SIMILAR_DEBOUNCE_MS = 300 // 글자마다 요청하지 않게 입력이 잠깐 멈추면 확인

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

/** 입력 중 "비슷한 토론이 있어요"(순서·띄어쓰기만 다른 같은 주제) */
export function useSimilar(a: string, b: string) {
  const [da, db] = useDebounced([a.trim(), b.trim()].join('\u0000'), SIMILAR_DEBOUNCE_MS).split('\u0000')
  const ready = da.length >= TOPIC_MIN && (db ?? '').length >= TOPIC_MIN
  return useQuery({
    queryKey: ['debates', 'similar', da, db],
    queryFn: () =>
      api<{ debate: DebateSummary | null }>(`/api/debates/similar?a=${encodeURIComponent(da)}&b=${encodeURIComponent(db)}`),
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useCreateDebate() {
  return useMutation({
    mutationFn: (body: { topic_a: string; topic_b: string }) => post<{ id: string }>('/api/debates', body),
  })
}
