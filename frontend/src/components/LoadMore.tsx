import { CaretDown } from '@phosphor-icons/react'
import styles from './LoadMore.module.css'

type Props = { shown: number; total: number; loading?: boolean; onClick: () => void }

/** MyDesign 17 Load More (MO) — "더보기 (4 / 24)" */
export function LoadMore({ shown, total, loading, onClick }: Props) {
  if (shown >= total) return null
  return (
    <button type="button" className={styles.loadMore} onClick={onClick} disabled={loading}>
      {loading ? '불러오는 중…' : `더보기 (${shown} / ${total})`}
      <CaretDown size={16} aria-hidden="true" />
    </button>
  )
}
