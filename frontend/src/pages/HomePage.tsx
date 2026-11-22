import { Skeleton } from '../components/Skeleton'
import { LoadError } from '../components/LoadError'
import { useTodayDebate } from '../features/debate/queries'
import { DebateListSection } from '../features/home/DebateListSection'
import { HomeEmpty } from '../features/home/HomeEmpty'
import { RecentLine } from '../features/home/RecentLine'
import { TodayCard } from '../features/home/TodayCard'
import styles from './HomePage.module.css'

/** HOM_01_001 홈 · HOM_01_002 빈 상태 */
export function HomePage() {
  const today = useTodayDebate()

  if (today.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height={360} radius={24} />
      </div>
    )
  }
  if (today.isError) return <LoadError error={today.error} onRetry={() => today.refetch()} withHome={false} />
  if (today.data === null) return <HomeEmpty />

  return (
    <div className={styles.page}>
      <TodayCard debate={today.data} />
      <div className={styles.lower}>
        <RecentLine />
        <DebateListSection />
      </div>
    </div>
  )
}
