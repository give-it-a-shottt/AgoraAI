import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import styles from './Pagination.module.css'

type Props = { page: number; totalPages: number; onChange: (page: number) => void }

const WINDOW = 5

/** MyDesign 17 Pagination PC C Fill — 번호 5개씩 */
export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1))
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i)
  return (
    <nav className={styles.pagination} aria-label="페이지">
      <button type="button" className={styles.arrow} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지">
        <CaretLeft size={18} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={p === page ? styles.current : styles.page}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button type="button" className={styles.arrow} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="다음 페이지">
        <CaretRight size={18} />
      </button>
    </nav>
  )
}
