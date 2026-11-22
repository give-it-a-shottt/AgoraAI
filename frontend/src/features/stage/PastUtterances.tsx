import { useId, useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import type { Utterance } from '../../api/types'
import { Button } from '../../components/Button'
import { ROUND_NAMES } from './StepperBar'
import styles from './PastUtterances.module.css'

type Props = { items: Utterance[]; nameOf: (u: Utterance) => string }

/** 지난 발언은 접어 둔다(§5: 말풍선을 쌓지 않음). 펼치면 순서대로 읽을 수 있다. */
export function PastUtterances({ items, nameOf }: Props) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  if (items.length === 0) return null
  return (
    <div className={styles.wrap}>
      <Button
        variant="text"
        size="m"
        tone="sub"
        icon={open ? <CaretUp size={20} /> : <CaretDown size={20} />}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '지난 발언 접기' : `지난 발언 ${items.length}개 펼쳐 보기`}
      </Button>
      {open && (
        <ol id={listId} className={styles.list}>
          {items.map((u) => (
            <li key={u.id} className={styles.item}>
              <p className={`ts-caption-13-m ${styles.meta}`}>
                {u.round}R {ROUND_NAMES[u.round - 1]} · {nameOf(u)}
              </p>
              <p className="ts-body-15-r">{u.text}</p>
              <p className={`ts-body-14-m ${styles.caption}`}>“{u.caption}”</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
