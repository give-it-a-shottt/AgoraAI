import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowClockwise, CaretLeft, CheckCircle, Question, Users, WarningCircle, XCircle } from '@phosphor-icons/react'
import { ApiError } from '../api/client'
import type { DebateDetail, Result } from '../api/types'
import { Button } from '../components/Button'
import { Character } from '../components/Character'
import { LoadError } from '../components/LoadError'
import { Skeleton } from '../components/Skeleton'
import { StateBlock } from '../components/StateBlock'
import { useToast } from '../components/toastContext'
import { titleOf, topicOf } from '../features/debate/cast'
import { HiddenDebate } from '../features/debate/HiddenDebate'
import { useDebateDetail } from '../features/debate/queries'
import { percent } from '../features/result/format'
import { MetricsPopup } from '../features/result/MetricsPopup'
import { useReport, useResult, useRetryJudge } from '../features/result/queries'
import { ReportPopup } from '../features/result/ReportPopup'
import { copyText, shareUrlOf } from '../lib/clipboard'
import styles from './ResultPage.module.css'

/** DEB_01_003 결과 (판정 실패 DEB_01_009, 지표 설명 DEB_01_005, 신고 DEB_01_006) */
export function ResultPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const detail = useDebateDetail(id)
  const result = useResult(id, detail.data ? !detail.data.hidden : false)

  if (!detail.data && detail.isError) return <LoadError error={detail.error} onRetry={() => detail.refetch()} />
  if (detail.data?.hidden || (result.error instanceof ApiError && result.error.code === 'hidden')) return <HiddenDebate />
  if (result.error instanceof ApiError && result.error.code === 'not_finished') {
    return (
      <StateBlock
        character="owl"
        title="아직 토론이 끝나지 않았어요"
        description="마지막 발언까지 끝나면 심판 부엉이가 판정해요."
        primary={{ label: '무대로 가기', onClick: () => navigate(`/debates/${encodeURIComponent(id)}/stage`) }}
      />
    )
  }
  if (!result.data && result.isError) return <LoadError error={result.error} onRetry={() => result.refetch()} />
  if (!detail.data || !result.data) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height={120} />
        <Skeleton height={96} radius={24} />
      </div>
    )
  }
  return <ResultView debate={detail.data} result={result.data} />
}

function ResultView({ debate, result }: { debate: DebateDetail; result: Result }) {
  const navigate = useNavigate()
  const toast = useToast()
  const retryJudge = useRetryJudge(debate.id)
  const report = useReport(debate.id)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const stagePath = `/debates/${encodeURIComponent(debate.id)}/stage`
  const judged = result.judge_status === 'done' && result.winner !== null

  const onRetryJudge = async () => {
    try {
      await retryJudge.mutateAsync()
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '판정을 다시 요청하지 못했어요.')
    }
  }

  const onReport = (reason: Parameters<typeof report.mutate>[0]) => {
    report.mutate(reason, {
      onSuccess: (res) => {
        setReportOpen(false)
        toast.show(res.hidden ? '신고가 쌓여 이 토론을 가렸어요.' : '신고했어요. 확인해 볼게요.')
      },
      onError: (e) => toast.show(e instanceof ApiError ? e.message : '신고하지 못했어요. 다시 시도해 주세요.'),
    })
  }

  // F-006에서 공유 시트로 바뀐다. 지금은 공유 주소를 복사한다.
  const onShare = async () => {
    toast.show((await copyText(shareUrlOf(debate.id))) ? '링크를 복사했어요' : '복사하지 못했어요. 주소창의 링크를 써 주세요.')
  }

  return (
    <div className={styles.page}>
      <Link to={stagePath} className={styles.back}>
        <CaretLeft size={18} aria-hidden="true" />
        <span className="ts-body-14-m">{titleOf(debate)}</span>
      </Link>

      <section className={styles.verdict} aria-labelledby="verdict-title">
        <div className={styles.verdictText}>
          <p className={`ts-body-15-m ${styles.sub}`}>AI 심판의 선택</p>
          <h1 id="verdict-title" className="ts-display-40">
            {judged ? `${result.winner} ${topicOf(debate, result.winner!)} 승` : '판정 준비 중'}
          </h1>
          <p className={`ts-body-15-r ${styles.sub}`} role={judged ? undefined : 'status'}>
            {judged
              ? result.judge_reason
              : result.judge_status === 'failed'
                ? '심판 부엉이가 판정을 정리하다 멈췄어요. 발언은 그대로 다시 볼 수 있어요.'
                : '심판 부엉이가 판정을 정리하고 있어요. 잠시만 기다려 주세요.'}
          </p>
        </div>
        <Character character="owl" size={160} className={styles.owl} />
      </section>

      <div className={styles.cards}>
        <PredictionCard debate={debate} result={result} retrying={retryJudge.isPending} onRetryJudge={onRetryJudge} />
        <AudienceCard debate={debate} result={result} />
      </div>

      {judged && (
        <>
          <hr className={styles.divider} />
          <section className={styles.quality} aria-labelledby="quality-title">
            <div className={styles.qualityHead}>
              <h2 id="quality-title" className="ts-title-20">
                이번 토론, 제대로 싸웠을까?
              </h2>
              <button type="button" className={styles.how} onClick={() => setMetricsOpen(true)}>
                <Question size={18} aria-hidden="true" />
                <span className="ts-body-14-m">어떻게 쟀나요?</span>
              </button>
            </div>
            <Meter label="제대로 맞붙은 발언" value={result.metrics.rebut_rate} tone="primary" />
            <Meter label="서로 맞장구친 발언" value={result.metrics.agree_rate} tone="muted" />
          </section>
        </>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" className={styles.flex1} onClick={() => navigate('/')}>
          다른 토론
        </Button>
        {judged ? (
          <Button className={styles.flex2} onClick={onShare}>
            결과 공유하기
          </Button>
        ) : (
          <Button className={styles.flex2} onClick={() => navigate(stagePath)}>
            무대로 돌아가기
          </Button>
        )}
      </div>

      <Button variant="text" size="m" tone="sub" className={styles.reportLink} onClick={() => setReportOpen(true)}>
        이 토론 신고하기
      </Button>

      <MetricsPopup
        open={metricsOpen}
        onClose={() => setMetricsOpen(false)}
        rebutRate={result.metrics.rebut_rate}
        agreeRate={result.metrics.agree_rate}
        humanAgreement={result.metrics.human_agreement}
      />
      <ReportPopup open={reportOpen} submitting={report.isPending} onClose={() => setReportOpen(false)} onSubmit={onReport} />
    </div>
  )
}

function PredictionCard({
  debate,
  result,
  retrying,
  onRetryJudge,
}: {
  debate: DebateDetail
  result: Result
  retrying: boolean
  onRetryJudge: () => void
}) {
  const mine = result.my_prediction
  if (result.judge_status === 'failed') {
    return (
      <div className={`${styles.card} ${styles.error}`}>
        <p className={`${styles.cardTitle} ${styles.errorText}`}>
          <WarningCircle size={24} weight="fill" aria-hidden="true" /> 판정을 아직 못 냈어요
        </p>
        <p className="ts-body-15-m">판정이 나오면 맞혔는지 알려 드려요</p>
        <Button variant="secondary" size="m" className={styles.retryJudge} icon={<ArrowClockwise size={20} />} softDisabled={retrying} onClick={onRetryJudge}>
          {retrying ? '요청하는 중…' : '판정 다시 요청'}
        </Button>
      </div>
    )
  }
  if (result.judge_status !== 'done' || result.winner === null) {
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>판정을 기다리는 중</p>
        <p className={`ts-body-14-r ${styles.sub}`}>{mine ? `내 예측  ${mine} ${topicOf(debate, mine)}` : '이번엔 예측 없이 봤어요'}</p>
      </div>
    )
  }
  if (!mine) {
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>다음엔 예측해 보세요</p>
        <p className={`ts-body-14-r ${styles.sub}`}>이번엔 예측 없이 봤어요</p>
      </div>
    )
  }
  const hit = mine === result.winner
  return (
    <div className={`${styles.card} ${hit ? styles.success : styles.error}`}>
      <p className={`${styles.cardTitle} ${hit ? styles.successText : styles.errorText}`}>
        {hit ? <CheckCircle size={24} weight="fill" aria-hidden="true" /> : <XCircle size={24} weight="fill" aria-hidden="true" />}
        {hit ? '맞혔어요!' : '아쉽게 빗나갔어요'}
      </p>
      <p className="ts-body-15-m">
        내 예측  {mine} {topicOf(debate, mine)}
      </p>
    </div>
  )
}

function AudienceCard({ debate, result }: { debate: DebateDetail; result: Result }) {
  const { count, a_ratio, b_ratio } = result.audience
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>
        <Users size={24} aria-hidden="true" /> 관객 {count}명 참여
      </p>
      <p className={`ts-body-14-r ${styles.sub}`}>
        {a_ratio === null || b_ratio === null
          ? '5명부터 관객 판정도 보여요'
          : `관객 예측  A ${debate.topic_a} ${percent(a_ratio)} · B ${debate.topic_b} ${percent(b_ratio)}`}
      </p>
    </div>
  )
}

function Meter({ label, value, tone }: { label: string; value: number | null; tone: 'primary' | 'muted' }) {
  const width = `${Math.round((value ?? 0) * 100)}%`
  return (
    <div className={styles.meter}>
      <div className={styles.meterLabel}>
        <span className={`ts-body-15-r ${styles.sub}`}>{label}</span>
        <span className="ts-headline-24">{percent(value)}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={tone === 'primary' ? styles.valuePrimary : styles.valueMuted} style={{ width }} />
      </div>
    </div>
  )
}
