import type { CastMember } from '../../api/types'
import { Character } from '../../components/Character'
import styles from './CastCard.module.css'

/** 출연 캐릭터 카드(제타 프로필 카드를 합침, §0-3) — 이름 · 편 · 어떤 AI · 말버릇 */
export function CastCard({ member, topic }: { member: CastMember; topic: string }) {
  return (
    <div className={styles.cast}>
      <span className={styles.avatar}>
        <Character character={member.character} size={100} />
      </span>
      <span className={styles.info}>
        <span className={styles.nameRow}>
          <span className="ts-title-18">{member.name}</span>
          <span className={`ts-body-14-r ${styles.sub}`}>
            {member.side} {topic} 편 · {member.ai}
          </span>
        </span>
        <span className={`ts-body-15-r ${styles.sub}`}>{member.catchphrase}</span>
      </span>
    </div>
  )
}
