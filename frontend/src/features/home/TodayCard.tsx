import { useNavigate } from 'react-router-dom'
import type { DebateSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Character } from '../../components/Character'
import { castInOrder, titleOf, topicOf } from '../debate/cast'
import { monthDay } from '../../lib/date'
import styles from './TodayCard.module.css'

/** 홈 첫 영역 "오늘의 토론"(Card 1개만, bg/regular · radius/card 24) */
export function TodayCard({ debate }: { debate: DebateSummary }) {
  const navigate = useNavigate()
  const label = debate.today_date ? `오늘의 토론 · ${monthDay(debate.today_date)}` : '지금 볼 만한 토론'
  const cast = castInOrder(debate)
  return (
    <section className={styles.card} aria-labelledby="today-title">
      <div className={styles.text}>
        <div className={styles.head}>
          <p className={`ts-body-15-m ${styles.sub}`}>{label}</p>
          <h1 id="today-title" className="ts-display-40">
            {titleOf(debate)}
          </h1>
        </div>
        <ul className={`ts-body-14-m ${styles.names}`}>
          {cast.map((c) => (
            <li key={c.character}>
              {c.name} · {topicOf(debate, c.side)} 편 · {c.ai}
            </li>
          ))}
        </ul>
        <div className={styles.cta}>
          <Button className={styles.ctaButton} onClick={() => navigate(`/debates/${debate.id}`)}>
            승부 예측하고 보기
          </Button>
          <p className={`ts-body-14-m ${styles.sub} ${styles.audience}`}>관객 {debate.prediction_count}명이 예측했어요</p>
        </div>
      </div>
      <div className={styles.characters}>
        {cast.map((c) => (
          <Character key={c.character} character={c.character} size={200} className={styles.character} />
        ))}
      </div>
    </section>
  )
}
