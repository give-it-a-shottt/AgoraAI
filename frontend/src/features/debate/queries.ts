import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { DebateDetail, DebateList, DebateSummary, SortKey } from '../../api/types'

export const PAGE_SIZE = 5

export const debateKeys = {
  today: ['debates', 'today'] as const,
  list: (sort: SortKey, page: number) => ['debates', 'list', sort, page] as const,
  infinite: (sort: SortKey) => ['debates', 'infinite', sort] as const,
  detail: (id: string) => ['debates', 'detail', id] as const,
}

const listUrl = (sort: SortKey, page: number) => `/api/debates?sort=${sort}&page=${page}&size=${PAGE_SIZE}`

/** 오늘의 토론. 하나도 없으면(404 no_today) null. */
export function useTodayDebate() {
  return useQuery({
    queryKey: debateKeys.today,
    queryFn: async () => {
      try {
        return await api<DebateSummary>('/api/debates/today')
      } catch (e) {
        if (e instanceof ApiError && e.code === 'no_today') return null
        throw e
      }
    },
  })
}

/** PC: 번호 페이지 */
export function useDebateList(sort: SortKey, page: number, enabled = true) {
  return useQuery({
    queryKey: debateKeys.list(sort, page),
    queryFn: () => api<DebateList>(listUrl(sort, page)),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** MO: 더보기로 이어 붙이기 */
export function useDebateListInfinite(sort: SortKey, enabled = true) {
  return useInfiniteQuery({
    queryKey: debateKeys.infinite(sort),
    queryFn: ({ pageParam }) => api<DebateList>(listUrl(sort, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    enabled,
  })
}

export function useDebateDetail(id: string) {
  return useQuery({ queryKey: debateKeys.detail(id), queryFn: () => api<DebateDetail>(`/api/debates/${encodeURIComponent(id)}`) })
}
