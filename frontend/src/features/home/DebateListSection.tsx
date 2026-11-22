import { useSearchParams } from 'react-router-dom'
import type { DebateSummary, SortKey } from '../../api/types'
import { LoadMore } from '../../components/LoadMore'
import { Pagination } from '../../components/Pagination'
import { Skeleton } from '../../components/Skeleton'
import { TabLine } from '../../components/TabLine'
import { Button } from '../../components/Button'
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { PAGE_SIZE, useDebateList, useDebateListInfinite } from '../debate/queries'
import { DebateRow } from './DebateRow'
import styles from './DebateListSection.module.css'

const TABS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: '인기' },
  { key: 'latest', label: '최신' },
]

/** 홈 "토론 둘러보기" — 인기·최신 탭, PC 번호 페이지 / MO 더보기. 정렬·페이지는 주소에 둔다(뒤로가기 유지). */
export function DebateListSection() {
  const [params, setParams] = useSearchParams()
  const sort: SortKey = params.get('sort') === 'latest' ? 'latest' : 'popular'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const paged = useDebateList(sort, page, !isMobile)
  const infinite = useDebateListInfinite(sort, isMobile)

  const items: DebateSummary[] = isMobile
    ? (infinite.data?.pages.flatMap((p) => p.items) ?? [])
    : (paged.data?.items ?? [])
  const total = (isMobile ? infinite.data?.pages[0]?.total : paged.data?.total) ?? 0
  const isLoading = isMobile ? infinite.isPending : paged.isPending
  const isError = isMobile ? infinite.isError : paged.isError
  const retry = () => (isMobile ? infinite.refetch() : paged.refetch())

  const update = (next: { sort?: SortKey; page?: number }) => {
    const p = new URLSearchParams(params)
    if (next.sort) p.set('sort', next.sort)
    if (next.sort) p.delete('page')
    if (next.page) p.set('page', String(next.page))
    setParams(p)
  }

  return (
    <section id="browse" className={styles.section} aria-labelledby="browse-title">
      <div className={styles.head}>
        <h2 id="browse-title" className="ts-headline-28">
          토론 둘러보기
        </h2>
        <TabLine tabs={TABS} value={sort} onChange={(s) => update({ sort: s })} label="정렬" />
      </div>
      <div className={styles.gap} />
      {isLoading ? (
        <ul className={styles.list} aria-busy="true" aria-label="토론 목록 불러오는 중">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <li key={i} className={styles.skeletonRow}>
              <Skeleton height={28} width="60%" />
              <Skeleton height={21} width={180} />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div className={styles.error} role="alert">
          <p className="ts-body-15-r">목록을 불러오지 못했어요.</p>
          <Button variant="secondary" size="m" onClick={() => retry()}>
            다시 시도
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className={`ts-body-15-r ${styles.empty}`}>아직 다른 토론이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((d) => (
            <DebateRow key={d.id} debate={d} />
          ))}
        </ul>
      )}
      <div className={styles.pager}>
        {isMobile ? (
          <LoadMore
            shown={items.length}
            total={total}
            loading={infinite.isFetchingNextPage}
            onClick={() => infinite.fetchNextPage()}
          />
        ) : (
          paged.data && (
            <Pagination page={page} totalPages={paged.data.total_pages} onChange={(p) => update({ page: p })} />
          )
        )}
      </div>
    </section>
  )
}
