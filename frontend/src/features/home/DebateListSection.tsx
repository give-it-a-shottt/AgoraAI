import type { SortKey } from '../../api/types'
import { Button } from '../../components/Button'
import { LoadMore } from '../../components/LoadMore'
import { Pagination } from '../../components/Pagination'
import { Skeleton } from '../../components/Skeleton'
import { TabLine } from '../../components/TabLine'
import { PAGE_SIZE } from '../debate/queries'
import { DebateRow } from './DebateRow'
import { useHomeList } from './useHomeList'
import styles from './DebateListSection.module.css'

const TABS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: '인기' },
  { key: 'latest', label: '최신' },
]

/** 홈 "토론 둘러보기" — 인기·최신 탭 + 목록 + PC 번호 페이지 / MO 더보기 */
export function DebateListSection() {
  const list = useHomeList()

  return (
    <section id="browse" className={styles.section} aria-labelledby="browse-title">
      <div className={styles.head}>
        <h2 id="browse-title" className="ts-headline-28">
          토론 둘러보기
        </h2>
        <TabLine tabs={TABS} value={list.sort} onChange={list.setSort} label="정렬" />
      </div>
      <div className={styles.gap} />
      <ListBody list={list} />
      <div className={styles.pager}>
        {list.isMobile ? (
          <>
            {list.isMoreError && (
              <p className={`ts-body-14-r ${styles.moreError}`} role="alert">
                더 불러오지 못했어요. 다시 눌러 주세요.
              </p>
            )}
            <LoadMore shown={list.items.length} total={list.total} loading={list.isFetchingMore} onClick={list.fetchMore} />
          </>
        ) : (
          !list.isLoading &&
          !list.isError && <Pagination page={list.page} totalPages={list.totalPages} onChange={list.setPage} />
        )}
      </div>
    </section>
  )
}

function ListBody({ list }: { list: ReturnType<typeof useHomeList> }) {
  if (list.isLoading) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label="토론 목록 불러오는 중">
        {Array.from({ length: PAGE_SIZE }, (_, i) => (
          <li key={i} className={styles.skeletonRow}>
            <Skeleton height={28} width="60%" />
            <Skeleton height={21} width={180} />
          </li>
        ))}
      </ul>
    )
  }
  if (list.isError) {
    return (
      <div className={styles.error} role="alert">
        <p className="ts-body-15-r">목록을 불러오지 못했어요.</p>
        <Button variant="secondary" size="m" onClick={list.retry}>
          다시 시도
        </Button>
      </div>
    )
  }
  if (list.items.length === 0) {
    return <p className={`ts-body-15-r ${styles.empty}`}>아직 다른 토론이 없어요.</p>
  }
  return (
    <ul className={styles.list}>
      {list.items.map((d) => (
        <DebateRow key={d.id} debate={d} />
      ))}
    </ul>
  )
}
