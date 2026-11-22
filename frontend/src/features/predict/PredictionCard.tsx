import { Check } from '@phosphor-icons/react'
import type { Side } from '../../api/types'
import styles from './PredictionCard.module.css'

type Props = {
  side: Side
  topic: string
  selected: boolean
  locked: boolean
  onSelect: (side: Side) => void
}

/** 승부 예측 선택 카드(로컬 컴포넌트, §7) — Radio 동작. 선택: 2px 테두리 + 체크 + "내 예측"(색만으로 구분하지 않음) */
export function PredictionCard({ side, topic, selected, locked, onSelect }: Props) {
  return (
    <label className={`${styles.card} ${selected ? styles.selected : ''} ${locked ? styles.locked : ''}`}>
      <input
        type="radio"
        name="prediction"
        value={side}
        checked={selected}
        disabled={locked && !selected}
        onChange={() => onSelect(side)}
        className="sr-only"
      />
      <span className={styles.top}>
        <span className={styles.side}>{side}</span>
        <span className={styles.check} aria-hidden="true">
          {selected && <Check size={14} weight="bold" />}
        </span>
      </span>
      <span className={styles.spacer} />
      <span className="ts-headline-24">{topic}</span>
      <span className={styles.hint}>{selected ? '내 예측' : '선택하기'}</span>
    </label>
  )
}
