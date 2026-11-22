import type { ReactNode } from 'react'
import { Button } from './Button'
import { Character, type CharacterKey } from './Character'
import styles from './StateBlock.module.css'

type Action = { label: string; onClick: () => void }

type Props = {
  title: string
  description?: ReactNode
  character?: CharacterKey
  primary?: Action
  secondary?: Action
  /** 페이지 전체 상태(가운데 정렬 740 영역) vs 결과 안 인라인 */
  layout?: 'page' | 'inline'
  children?: ReactNode
}

/** MyDesign 25 Empty·Error 공통 블록 — 제목·설명·주 행동 1 + 보조 1, 위에 캐릭터 1명(§7) */
export function StateBlock({
  title,
  description,
  character = 'penguin',
  primary,
  secondary,
  layout = 'page',
  children,
}: Props) {
  return (
    <section className={layout === 'page' ? styles.page : styles.inline} role="status">
      <Character character={character} size={layout === 'page' ? 160 : 120} />
      <div className={styles.block}>
        <div className={styles.text}>
          <h1 className="ts-headline-20">{title}</h1>
          {description && <p className={`ts-body-15-r ${styles.desc}`}>{description}</p>}
        </div>
        {children}
        {(primary || secondary) && (
          <div className={styles.buttons}>
            {primary && (
              <Button size="l" fullWidth onClick={primary.onClick}>
                {primary.label}
              </Button>
            )}
            {secondary && (
              <Button size="l" variant="secondary" fullWidth onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
