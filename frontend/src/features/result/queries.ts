import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import type { ReportReason, Result } from '../../api/types'
import { debateKeys } from '../debate/queries'

export const resultKey = (id: string) => ['debates', 'result', id] as const
const base = (id: string) => `/api/debates/${encodeURIComponent(id)}`

/** 결과. 판정 중(pending)이면 2.5초마다 다시 읽는다. */
export function useResult(debateId: string, enabled = true) {
  return useQuery({
    queryKey: resultKey(debateId),
    queryFn: () => api<Result>(`${base(debateId)}/result`),
    refetchInterval: (q) => (q.state.data?.judge_status === 'pending' ? 2500 : false),
    enabled,
  })
}

export function useRetryJudge(debateId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post<Result>(`${base(debateId)}/judge/retry`),
    onSuccess: (data) => qc.setQueryData(resultKey(debateId), data),
  })
}

export function useReport(debateId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: ReportReason) => post<{ reported: boolean; hidden: boolean }>(`${base(debateId)}/reports`, { reason }),
    onSuccess: (res) => {
      if (res.hidden) void qc.invalidateQueries({ queryKey: debateKeys.detail(debateId) })
    },
  })
}
