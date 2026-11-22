import { Skeleton } from '../components/Skeleton'
import { StateBlock } from '../components/StateBlock'
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
  if (today.isError) {
    return (
      <StateBlock
        title="토론을 불러오지 못했어요"
        description="인터넷 연결을 확인하고 다시 시도해 주세요."
        primary={{ label: '다시 시도', onClick: () => today.refetch() }}
      />
    )
  }
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
