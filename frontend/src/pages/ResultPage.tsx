import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CaretLeft, Question } from '@phosphor-icons/react'
import { ApiError } from '../api/client'
import type { DebateDetail, ReportReason, Result } from '../api/types'
import { Button } from '../components/Button'
import { Character } from '../components/Character'
import { LoadError } from '../components/LoadError'
import { Skeleton } from '../components/Skeleton'
import { StateBlock } from '../components/StateBlock'
import { useToast } from '../components/toastContext'
import { titleOf, topicOf } from '../features/debate/cast'
import { HiddenDebate } from '../features/debate/HiddenDebate'
import { useDebateDetail } from '../features/debate/queries'
import { AudienceCard, Meter, PredictionCard } from '../features/result/cards'
import { MetricsPopup } from '../features/result/MetricsPopup'
import { resultKey, useReport, useResult, useRetryJudge } from '../features/result/queries'
import { ReportPopup } from '../features/result/ReportPopup'
import { SharePopup } from '../features/result/SharePopup'
import { isJudged } from '../features/result/rules'
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
  const qc = useQueryClient()
  const retryJudge = useRetryJudge(debate.id)
  const report = useReport(debate.id)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [judgeLimited, setJudgeLimited] = useState(false)
  const retried = useRef(false)
  const stagePath = `/debates/${encodeURIComponent(debate.id)}/stage`
  const judged = isJudged(result)

  // 다시 요청한 판정이 또 실패하면 알려 준다(버튼만 돌아오면 아무 일도 없던 것처럼 보이니까).
  useEffect(() => {
    if (!retried.current) return
    if (result.judge_status === 'failed') {
      retried.current = false
      toast.show('아직 판정하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    } else if (result.judge_status === 'done') {
      retried.current = false
    }
  }, [result.judge_status, toast])

  const onRetryJudge = async () => {
    try {
      await retryJudge.mutateAsync()
      retried.current = true
    } catch (e) {
      if (e instanceof ApiError && e.code === 'judge_limit') setJudgeLimited(true)
      toast.show(e instanceof ApiError ? e.message : '판정을 다시 요청하지 못했어요.')
      void qc.invalidateQueries({ queryKey: resultKey(debate.id) }) // 다른 탭에서 끝났을 수도 있다
    }
  }

  const onReport = (reason: ReportReason) => {
    report.mutate(reason, {
      onSuccess: (res) => {
        setReportOpen(false)
        toast.show(res.hidden ? '신고가 쌓여 이 토론을 가렸어요.' : '신고했어요. 확인해 볼게요.')
      },
      onError: (e) => toast.show(e instanceof ApiError ? e.message : '신고하지 못했어요. 다시 시도해 주세요.'),
    })
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
            {judged ? `${result.winner} ${topicOf(debate, result.winner)} 승` : '판정 준비 중'}
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
        <PredictionCard
          debate={debate}
          result={result}
          retrying={retryJudge.isPending}
          canRetry={!judgeLimited}
          onRetryJudge={onRetryJudge}
        />
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
          <Button className={styles.flex2} onClick={() => setShareOpen(true)}>
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
      <SharePopup open={shareOpen} debate={debate} onClose={() => setShareOpen(false)} />
      <ReportPopup open={reportOpen} submitting={report.isPending} onClose={() => setReportOpen(false)} onSubmit={onReport} />
    </div>
  )
}
