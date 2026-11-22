import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import type { DebateStatus, UtteranceList } from '../../api/types'

export const POLL_MS = 2500 // 생성 중일 때 새 발언 확인 간격

export const utterancesKey = (id: string) => ['debates', 'utterances', id] as const

/** 쌓인 발언 전부(최대 6개). 생성 중이면 주기적으로 다시 읽는다 — 화면은 DB만 읽는다(D-003). */
export function useUtterances(debateId: string, enabled = true) {
  return useQuery({
    queryKey: utterancesKey(debateId),
    queryFn: () => api<UtteranceList>(`/api/debates/${encodeURIComponent(debateId)}/utterances?after=0`),
    refetchInterval: (q) => (q.state.data?.status === 'generating' ? POLL_MS : false),
    enabled,
  })
}

export function useRetry(debateId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post<{ status: DebateStatus }>(`/api/debates/${encodeURIComponent(debateId)}/retry`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: utterancesKey(debateId) }),
  })
}

export function useEmpathy(debateId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (utteranceId: number) =>
      post<{ count: number; empathized: boolean }>(`/api/utterances/${utteranceId}/empathy`),
    onSuccess: (res, utteranceId) => {
      qc.setQueryData<UtteranceList>(utterancesKey(debateId), (old) =>
        old && { ...old, items: old.items.map((u) => (u.id === utteranceId ? { ...u, empathy_count: res.count } : u)) },
      )
    },
  })
}
