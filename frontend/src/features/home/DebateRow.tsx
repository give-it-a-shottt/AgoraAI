import { Link } from 'react-router-dom'
import type { DebateSummary } from '../../api/types'
import { Badge } from '../../components/Badge'
import { relativeDay } from '../../lib/date'
import { titleOf } from '../debate/cast'
import styles from './DebateRow.module.css'

/** 목록 한 줄(16 List) — 주제 문장이 주인공, 승자는 숨기고 진행 중/완료만 */
export function DebateRow({ debate }: { debate: DebateSummary }) {
  return (
    <li className={styles.row}>
      <Link to={`/debates/${debate.id}`} className={styles.link}>
        <span className="ts-title-20">{titleOf(debate)}</span>
        <span className={styles.meta}>
          <Badge status={debate.status === 'done' ? 'done' : 'live'} />
          <span className="ts-body-14-r">
            관객 {debate.prediction_count}명 예측 · {relativeDay(debate.created_at)}
          </span>
        </span>
      </Link>
    </li>
  )
}
