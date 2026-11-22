import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DebateSummary, SortKey } from '../../api/types'
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useDebateList, useDebateListInfinite } from '../debate/queries'

const MAX_PAGE = 1000 // 서버 제한(routers/debates.py MAX_PAGE)과 같게

/** 주소의 page 값을 1~1000 정수로 보정한다(이상한 값이면 1). */
export function parsePage(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAGE ? n : 1
}

export type HomeList = {
  sort: SortKey
  page: number
  isMobile: boolean
  items: DebateSummary[]
  total: number
  totalPages: number
  isLoading: boolean
  /** 보여 줄 게 하나도 없는 실패(전체 에러 블록) */
  isError: boolean
  /** 이미 목록이 있는데 더보기만 실패(작은 재시도) */
  isMoreError: boolean
  isFetchingMore: boolean
  retry: () => void
  fetchMore: () => void
  setSort: (sort: SortKey) => void
  setPage: (page: number) => void
}

/** 홈 목록 데이터: 정렬·페이지는 주소(?sort=&page=), PC는 번호 페이지 / MO는 더보기. */
export function useHomeList(): HomeList {
  const [params, setParams] = useSearchParams()
  const sort: SortKey = params.get('sort') === 'latest' ? 'latest' : 'popular'
  const page = parsePage(params.get('page'))
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const paged = useDebateList(sort, page, !isMobile)
  const infinite = useDebateListInfinite(sort, isMobile)

  const update = (next: { sort?: SortKey; page?: number }) => {
    const p = new URLSearchParams(params)
    if (next.sort) {
      p.set('sort', next.sort)
      p.delete('page')
    }
    if (next.page) p.set('page', String(next.page))
    setParams(p)
  }

  // 없는 페이지(예: 마지막 페이지보다 큼)면 마지막 페이지로 바꾼다.
  const lastPage = paged.data?.total_pages
  useEffect(() => {
    if (!isMobile && lastPage && page > lastPage) {
      const p = new URLSearchParams(params)
      p.set('page', String(lastPage))
      setParams(p, { replace: true })
    }
  }, [isMobile, lastPage, page, params, setParams])

  if (isMobile) {
    const items = infinite.data?.pages.flatMap((pg) => pg.items) ?? []
    return {
      sort,
      page,
      isMobile,
      items,
      total: infinite.data?.pages[0]?.total ?? 0,
      totalPages: infinite.data?.pages[0]?.total_pages ?? 1,
      isLoading: infinite.isPending,
      isError: infinite.isError && items.length === 0,
      isMoreError: infinite.isFetchNextPageError,
      isFetchingMore: infinite.isFetchingNextPage,
      retry: () => void infinite.refetch(),
      fetchMore: () => void infinite.fetchNextPage(),
      setSort: (s) => update({ sort: s }),
      setPage: (pg) => update({ page: pg }),
    }
  }
  return {
    sort,
    page,
    isMobile,
    items: paged.data?.items ?? [],
    total: paged.data?.total ?? 0,
    totalPages: paged.data?.total_pages ?? 1,
    isLoading: paged.isPending,
    isError: paged.isError,
    isMoreError: false,
    isFetchingMore: false,
    retry: () => void paged.refetch(),
    fetchMore: () => {},
    setSort: (s) => update({ sort: s }),
    setPage: (pg) => update({ page: pg }),
  }
}
