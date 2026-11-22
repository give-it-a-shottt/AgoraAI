import { ArrowClockwise, CheckCircle, Users, WarningCircle, XCircle } from '@phosphor-icons/react'
import type { DebateDetail, Result } from '../../api/types'
import { Button } from '../../components/Button'
import { topicOf } from '../debate/cast'
import { percent } from './format'
import { AUDIENCE_MIN, isJudged } from './rules'
import styles from './cards.module.css'

type PredictionProps = {
  debate: DebateDetail
  result: Result
  retrying: boolean
  canRetry: boolean
  onRetryJudge: () => void
}

/** 내 예측 vs AI 심판 — 적중·빗나감은 아이콘 + 글자 + 색(색만으로 구분하지 않음), 판정 실패면 DEB_01_009 카드 */
export function PredictionCard({ debate, result, retrying, canRetry, onRetryJudge }: PredictionProps) {
  const mine = result.my_prediction
  if (result.judge_status === 'failed') {
    return (
      <div className={`${styles.card} ${styles.error}`}>
        <p className={`${styles.title} ${styles.errorText}`}>
          <WarningCircle size={24} weight="fill" aria-hidden="true" /> 판정을 아직 못 냈어요
        </p>
        <p className="ts-body-15-m">{canRetry ? '판정이 나오면 맞혔는지 알려 드려요' : '판정을 더 시도할 수 없어요. 발언은 그대로 볼 수 있어요.'}</p>
        {canRetry && (
          <Button
            variant="secondary"
            size="m"
            className={styles.retry}
            icon={<ArrowClockwise size={20} />}
            softDisabled={retrying}
            onClick={onRetryJudge}
          >
            {retrying ? '요청하는 중…' : '판정 다시 요청'}
          </Button>
        )}
      </div>
    )
  }
  if (!isJudged(result)) {
    return (
      <div className={styles.card}>
        <p className={styles.title}>판정을 기다리는 중</p>
        <p className={`ts-body-14-r ${styles.sub}`}>{mine ? `내 예측  ${mine} ${topicOf(debate, mine)}` : '이번엔 예측 없이 봤어요'}</p>
      </div>
    )
  }
  if (!mine) {
    return (
      <div className={styles.card}>
        <p className={styles.title}>다음엔 예측해 보세요</p>
        <p className={`ts-body-14-r ${styles.sub}`}>이번엔 예측 없이 봤어요</p>
      </div>
    )
  }
  const hit = mine === result.winner
  return (
    <div className={`${styles.card} ${hit ? styles.success : styles.error}`}>
      <p className={`${styles.title} ${hit ? styles.successText : styles.errorText}`}>
        {hit ? <CheckCircle size={24} weight="fill" aria-hidden="true" /> : <XCircle size={24} weight="fill" aria-hidden="true" />}
        {hit ? '맞혔어요!' : '아쉽게 빗나갔어요'}
      </p>
      <p className="ts-body-15-m">
        내 예측  {mine} {topicOf(debate, mine)}
      </p>
    </div>
  )
}

/** 관객 — 5명 이상일 때만 분포(§0-4) */
export function AudienceCard({ debate, result }: { debate: DebateDetail; result: Result }) {
  const { count, a_ratio, b_ratio } = result.audience
  return (
    <div className={`${styles.card} ${styles.audience}`}>
      <p className={styles.title}>
        <Users size={24} aria-hidden="true" /> 관객 {count}명 참여
      </p>
      <p className={`ts-body-14-r ${styles.sub}`}>
        {a_ratio === null || b_ratio === null
          ? `${AUDIENCE_MIN}명부터 관객 판정도 보여요`
          : `관객 예측  A ${debate.topic_a} ${percent(a_ratio)} · B ${debate.topic_b} ${percent(b_ratio)}`}
      </p>
    </div>
  )
}

/** 풀어 쓴 지표 한 줄(숫자는 글자로 읽히고 막대는 장식) */
export function Meter({ label, value, tone }: { label: string; value: number | null; tone: 'primary' | 'muted' }) {
  return (
    <div className={styles.meter}>
      <div className={styles.meterLabel}>
        <span className={`ts-body-15-r ${styles.sub}`}>{label}</span>
        <span className="ts-headline-24">{percent(value)}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={tone === 'primary' ? styles.valuePrimary : styles.valueMuted} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      </div>
    </div>
  )
}
