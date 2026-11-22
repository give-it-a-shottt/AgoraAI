import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CaretLeft, Copy } from '@phosphor-icons/react'
import type { Side } from '../api/types'
import { Button } from '../components/Button'
import { LoadError } from '../components/LoadError'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../components/toastContext'
import { castInOrder, titleOf, topicOf } from '../features/debate/cast'
import { HiddenDebate } from '../features/debate/HiddenDebate'
import { useDebateDetail } from '../features/debate/queries'
import { CastCard } from '../features/predict/CastCard'
import { PredictionCard } from '../features/predict/PredictionCard'
import { useMyPrediction, usePredict } from '../features/predict/queries'
import { copyText, shareUrlOf } from '../lib/clipboard'
import { withRo } from '../lib/korean'
import { monthDay, relativeDay } from '../lib/date'
import { setViewChoice } from '../lib/viewState'
import styles from './PredictPage.module.css'

/** DEB_01_001 승부 예측 (가려진 토론이면 DEB_01_008) */
export function PredictPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const detail = useDebateDetail(id)
  const mine = useMyPrediction(id, detail.data ? !detail.data.hidden : false)
  const predict = usePredict(id)
  const [choice, setChoice] = useState<Side | null>(null)

  if (detail.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height={44} width="50%" />
        <Skeleton height={136} radius={24} />
      </div>
    )
  }
  if (detail.isError) return <LoadError error={detail.error} onRetry={() => detail.refetch()} />
  const debate = detail.data
  if (debate.hidden) return <HiddenDebate />

  const locked = mine.data ?? null // 이미 예측했으면 그 값으로 고정
  const selected = locked ?? choice
  const stagePath = `/debates/${encodeURIComponent(id)}/stage`
  const dateLabel = debate.today_date
    ? `${monthDay(debate.today_date)} · 오늘의 토론`
    : `${relativeDay(debate.created_at)} · 토론`

  const goWatch = async () => {
    if (locked) {
      setViewChoice(id, locked)
      navigate(stagePath)
      return
    }
    if (!choice) return
    try {
      const saved = await predict.mutateAsync(choice)
      setViewChoice(id, saved ?? choice)
      navigate(stagePath)
    } catch {
      toast.show('예측을 저장하지 못했어요. 다시 눌러 주세요.')
    }
  }

  const skip = () => {
    setViewChoice(id, 'skip')
    navigate(stagePath)
  }

  const copyLink = async () => {
    toast.show((await copyText(shareUrlOf(id))) ? '링크를 복사했어요' : '복사하지 못했어요. 주소창의 링크를 써 주세요.')
  }

  const ctaLabel = locked
    ? '이어서 보기'
    : choice
      ? `${withRo(topicOf(debate, choice))} 예측하고 보기`
      : '예측하고 보기'

  return (
    <div className={styles.page}>
      <header className={styles.topic}>
        <Link to="/" className={styles.back}>
          <CaretLeft size={18} aria-hidden="true" />
          <span className="ts-body-14-m">홈으로</span>
        </Link>
        <div className={styles.gap8} />
        <p className={`ts-body-14-m ${styles.weak}`}>{dateLabel}</p>
        <h1 className="ts-headline-32">{titleOf(debate)}</h1>
      </header>

      <section className={styles.predict} aria-labelledby="predict-q">
        <div className={styles.qhead}>
          <h2 id="predict-q" className="ts-headline-24">
            누가 이길까요?
          </h2>
          <p className={`ts-body-15-r ${styles.sub}`}>
            {locked ? '이미 예측했어요. 결과 화면에서 맞혔는지 확인할 수 있어요.' : 'AI 심판의 판정을 맞혀 보세요. 결과 화면에서 확인할 수 있어요.'}
          </p>
        </div>
        <div className={styles.cards} role="radiogroup" aria-labelledby="predict-q">
          {(['A', 'B'] as const).map((side) => (
            <PredictionCard
              key={side}
              side={side}
              topic={topicOf(debate, side)}
              selected={selected === side}
              locked={!!locked}
              onSelect={setChoice}
            />
          ))}
        </div>
      </section>

      <section className={styles.cast} aria-labelledby="cast-title">
        <h2 id="cast-title" className="ts-title-20">
          출연
        </h2>
        <div className={styles.castRow}>
          {castInOrder(debate).map((m) => (
            <CastCard key={m.character} member={m} topic={topicOf(debate, m.side)} />
          ))}
        </div>
      </section>

      <hr className={styles.divider} />

      <div className={styles.actions}>
        <div className={styles.links}>
          <Button variant="text" size="m" icon={<Copy size={20} />} className={styles.copy} onClick={copyLink}>
            링크 복사
          </Button>
          {!locked && (
            <Button variant="text" size="m" tone="sub" onClick={skip}>
              예측 없이 보기
            </Button>
          )}
        </div>
        <Button
          className={styles.cta}
          softDisabled={!selected || predict.isPending}
          aria-describedby={!selected ? 'cta-hint' : undefined}
          onClick={goWatch}
        >
          {predict.isPending ? '저장하는 중…' : ctaLabel}
        </Button>
        {!selected && (
          <span id="cta-hint" className="sr-only">
            A와 B 중 하나를 먼저 골라 주세요
          </span>
        )}
      </div>
    </div>
  )
}
