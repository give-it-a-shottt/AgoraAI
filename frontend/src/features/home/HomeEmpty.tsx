import { useNavigate } from 'react-router-dom'
import { Chip } from '../../components/Chip'
import { StateBlock } from '../../components/StateBlock'
import { createPathFor, TOPIC_SUGGESTIONS } from '../create/suggestions'
import styles from './HomeEmpty.module.css'

/** HOM_01_002 홈 빈 상태 — 추천 주제 3개 + 첫 토론 만들기 */
export function HomeEmpty() {
  const navigate = useNavigate()
  return (
    <StateBlock
      character="cat"
      title="아직 토론이 없어요"
      description="첫 밸런스 게임을 던지면 냥냥이와 펭펭이가 바로 붙어요."
      primary={{ label: '첫 토론 만들기', onClick: () => navigate('/create') }}
    >
      <div className={styles.chips}>
        {TOPIC_SUGGESTIONS.slice(0, 3).map((t) => (
          <Chip key={t.a} onClick={() => navigate(createPathFor(t))}>
            {t.a} vs {t.b}
          </Chip>
        ))}
      </div>
    </StateBlock>
  )
}
