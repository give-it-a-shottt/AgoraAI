import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { loadRecentDebate } from '../../lib/recentDebates'
import { titleOf } from '../debate/cast'
import styles from './RecentLine.module.css'

/** "방금 만든 토론" 한 줄 — 만든 사람의 복귀 경로(§0-6 UX 검수) */
export function RecentLine() {
  const recent = loadRecentDebate()
  if (!recent) return null
  return (
    <Link to={`/debates/${recent.id}`} className={styles.line}>
      <span className={`ts-caption-13-m ${styles.label}`}>방금 만든 토론</span>
      <span className="ts-body-15-m">{titleOf(recent)}</span>
      <CaretRight size={16} aria-hidden="true" />
    </Link>
  )
}
