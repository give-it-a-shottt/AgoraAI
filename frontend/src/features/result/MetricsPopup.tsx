import { Button } from '../../components/Button'
import { Popup } from '../../components/Popup'
import { percent } from './format'
import styles from './popups.module.css'

type Props = {
  open: boolean
  onClose: () => void
  rebutRate: number | null
  agreeRate: number | null
  humanAgreement: number | null
}

/** DEB_01_005 지표 설명 — 반박 판정 규칙과 사람 분류와의 일치율 */
export function MetricsPopup({ open, onClose, rebutRate, agreeRate, humanAgreement }: Props) {
  return (
    <Popup open={open} title="어떻게 쟀나요?" onClose={onClose}>
      <div className={styles.item}>
        <p className="ts-title-16">제대로 맞붙은 발언 {percent(rebutRate)}</p>
        <p className={`ts-body-14-r ${styles.sub}`}>
          상대가 방금 한 말의 근거를 짚어 반박한 발언의 비율이에요. 자기 말만 반복하면 세지 않아요.
        </p>
      </div>
      <div className={styles.item}>
        <p className="ts-title-16">서로 맞장구친 발언 {percent(agreeRate)}</p>
        <p className={`ts-body-14-r ${styles.sub}`}>
          상대 주장에 “그건 맞아요”처럼 동의한 발언의 비율이에요. 높으면 토론이 싱거웠다는 뜻이에요.
        </p>
      </div>
      <div className={styles.item}>
        <p className="ts-title-16">누가 쟀나요?</p>
        <p className={`ts-body-14-r ${styles.sub}`}>
          심판 AI가 정해진 규칙대로 발언마다 표시해요.{' '}
          {humanAgreement === null
            ? '사람이 직접 분류한 결과와 얼마나 같은지는 아직 재는 중이에요.'
            : `사람이 직접 분류해 보니 ${percent(humanAgreement)}가 같았어요.`}
        </p>
      </div>
      <Button size="l" fullWidth onClick={onClose}>
        알겠어요
      </Button>
    </Popup>
  )
}
