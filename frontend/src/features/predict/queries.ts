import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import type { Side } from '../../api/types'
import { debateKeys } from '../debate/queries'

type PredictionOut = { pick: Side | null }

export const predictionKey = (id: string) => ['debates', 'prediction', id] as const

const path = (id: string) => `/api/debates/${encodeURIComponent(id)}/predictions`

/** 이 브라우저의 예측(없으면 null) */
export function useMyPrediction(debateId: string, enabled = true) {
  return useQuery({
    queryKey: predictionKey(debateId),
    queryFn: async () => (await api<PredictionOut>(`${path(debateId)}/me`)).pick,
    enabled,
  })
}

/** 예측 저장. 서버는 처음 예측만 인정하고 그 값을 돌려준다. */
export function usePredict(debateId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pick: Side) => (await post<PredictionOut>(path(debateId), { pick })).pick,
    onSuccess: (pick) => {
      qc.setQueryData(predictionKey(debateId), pick)
      void qc.invalidateQueries({ queryKey: debateKeys.detail(debateId) })
    },
  })
}
