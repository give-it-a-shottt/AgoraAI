import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CaretLeft, Heart, Pause, Play } from '@phosphor-icons/react'
import { ApiError } from '../api/client'
import type { DebateDetail, Utterance, UtteranceList } from '../api/types'
import { Button } from '../components/Button'
import { Character } from '../components/Character'
import { LoadError } from '../components/LoadError'
import { Skeleton } from '../components/Skeleton'
import { StateBlock } from '../components/StateBlock'
import { useToast } from '../components/toastContext'
import { memberOf, titleOf, topicOf } from '../features/debate/cast'
import { HiddenDebate } from '../features/debate/HiddenDebate'
import { useDebateDetail } from '../features/debate/queries'
import { CaptionBox } from '../features/stage/CaptionBox'
import { PastUtterances } from '../features/stage/PastUtterances'
import { useEmpathy, useRetry, useUtterances } from '../features/stage/queries'
import { ROUND_NAMES, StepperBar } from '../features/stage/StepperBar'
import { useTypewriter } from '../features/stage/useTypewriter'
import { withIGa } from '../lib/korean'
import { useReducedMotion } from '../lib/useReducedMotion'
import { getViewChoice } from '../lib/viewState'
import styles from './StagePage.module.css'

export const AUTO_ADVANCE_MS = 2500 // 다시보기: 자막이 뜬 뒤 다음 발언까지
export const SLOW_AFTER_S = 30 // §8 대기 30초 → "생각보다 오래 걸리고 있어요"
export const STALLED_AFTER_S = 60 // §8 대기 60초 → Error Inline + [다시 시도]

/** DEB_01_002 무대 (멈춤 DEB_01_007, 가려짐 DEB_01_008) */
export function StagePage() {
  const { id = '' } = useParams()
  const detail = useDebateDetail(id)
  const utterances = useUtterances(id, detail.data ? !detail.data.hidden : false)

  if (detail.isError) return <LoadError error={detail.error} onRetry={() => detail.refetch()} />
  if (detail.data?.hidden) return <HiddenDebate />
  if (utterances.isError) {
    if (utterances.error instanceof ApiError && utterances.error.code === 'hidden') return <HiddenDebate />
    return <LoadError error={utterances.error} onRetry={() => utterances.refetch()} />
  }
  if (!detail.data || !utterances.data) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height={44} width="60%" />
        <Skeleton height={320} radius={24} />
      </div>
    )
  }
  return <Stage debate={detail.data} list={utterances.data} refetch={() => utterances.refetch()} />
}

type StageProps = { debate: DebateDetail; list: UtteranceList; refetch: () => void }

function Stage({ debate, list, refetch }: StageProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const reduced = useReducedMotion()
  const retry = useRetry(debate.id)
  const empathy = useEmpathy(debate.id)

  const items = list.items
  const [index, setIndex] = useState(0)
  const [autoplay] = useState(() => list.status === 'done') // 다 만들어진 토론은 다시보기 자동 진행
  const [userPaused, setUserPaused] = useState(false)
  const [hold, setHold] = useState(false) // 마우스·포커스를 올리면 멈춤(17장)
  const [viewPartial, setViewPartial] = useState(false)
  const [empathized, setEmpathized] = useState<ReadonlySet<number>>(new Set())
  const [waitStart, setWaitStart] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const current: Utterance | undefined = items[Math.min(index, items.length - 1)]
  const typing = useTypewriter(current?.text ?? '', current?.id ?? 0, reduced)
  const nextAvailable = index + 1 < items.length
  const isLast = current?.seq === list.total
  const atEnd = !nextAvailable && typing.done
  const nameOf = (u: Pick<Utterance, 'side'>) => memberOf(debate, u.side).name
  const nextSeq = (current?.seq ?? 0) + 1
  const nextSide = nextSeq % 2 === 1 ? 'A' : 'B'
  const nextMember = memberOf(debate, nextSide)
  const nextRound = Math.ceil(nextSeq / 2)

  const generating = list.status === 'generating'
  const waiting = generating && (items.length === 0 || (atEnd && !isLast))
  const showPaused = list.status === 'paused' && (items.length === 0 || !viewPartial || (atEnd && !isLast))
  const elapsed = waitStart === null ? 0 : (now - waitStart) / 1000

  // 기다리기 시작한 시각을 기억하고 1초마다 다시 그려 30초·60초 안내를 띄운다.
  useEffect(() => {
    if (!waiting) {
      setWaitStart(null)
      return
    }
    setWaitStart((s) => s ?? Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [waiting])

  // 다시보기 자동 진행: 자막이 뜨고 잠시 뒤 다음 발언으로.
  useEffect(() => {
    if (!autoplay || userPaused || hold || !typing.done || !nextAvailable) return
    const timer = window.setTimeout(() => setIndex((i) => i + 1), AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [autoplay, userPaused, hold, typing.done, nextAvailable, index])

  const resultPath = `/debates/${encodeURIComponent(debate.id)}/result`
  const canJumpToResult = getViewChoice(debate.id) !== null

  const onNext = () => {
    if (!typing.done) return typing.complete()
    if (nextAvailable) return setIndex((i) => i + 1)
    if (isLast) navigate(resultPath)
  }

  const onRetry = async () => {
    try {
      await retry.mutateAsync()
      setViewPartial(true)
      setWaitStart(null)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'retry_too_soon') {
        toast.show(`${Number(e.extra.retry_after) || 60}초 뒤에 다시 시도해 주세요.`)
      } else if (e instanceof ApiError && e.code === 'retry_limit') {
        toast.show('이 토론은 더 이어서 만들 수 없어요. 다른 토론을 봐 주세요.')
      } else if (e instanceof ApiError && e.code === 'not_paused') {
        refetch() // 그사이 다시 생성 중이 됐다
      } else {
        toast.show('다시 시도하지 못했어요. 잠시 후 눌러 주세요.')
      }
    }
  }

  const onEmpathy = (u: Utterance) => {
    if (empathized.has(u.id)) return
    setEmpathized((s) => new Set(s).add(u.id))
    empathy.mutate(u.id, {
      onError: () => {
        setEmpathized((s) => {
          const next = new Set(s)
          next.delete(u.id)
          return next
        })
        toast.show('공감을 남기지 못했어요.')
      },
    })
  }

  const header = (
    <>
      <div className={styles.titleRow}>
        <div className={styles.backTitle}>
          <Link to={`/debates/${encodeURIComponent(debate.id)}`} className={styles.back} aria-label="승부 예측으로 돌아가기">
            <CaretLeft size={24} />
          </Link>
          <h1 className="ts-title-20">{titleOf(debate)}</h1>
        </div>
        {canJumpToResult && (
          <Button variant="text" size="m" onClick={() => navigate(resultPath)}>
            결과 바로 보기
          </Button>
        )}
      </div>
      <div className={styles.roundRow}>
        <StepperBar round={current?.round ?? 1} />
        {autoplay && (
          <button
            type="button"
            className={styles.pause}
            aria-label={userPaused ? '자동 진행 재생' : '자동 진행 멈춤'}
            aria-pressed={userPaused}
            onClick={() => setUserPaused((v) => !v)}
          >
            {userPaused ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
          </button>
        )}
      </div>
    </>
  )

  if (showPaused) {
    const doneRounds = Math.floor(items.length / 2)
    return (
      <div className={styles.page}>
        {header}
        <StateBlock
          layout="inline"
          character="penguin"
          title="토론이 잠깐 멈췄어요"
          description={
            doneRounds > 0
              ? `${doneRounds}라운드까지는 완성됐어요. 다시 시도하면 멈춘 곳부터 이어서 만들어요.`
              : '다시 시도하면 처음부터 이어서 만들어요.'
          }
          primary={{ label: retry.isPending ? '요청하는 중…' : '다시 시도', onClick: onRetry }}
          secondary={
            items.length > 0 && !viewPartial
              ? { label: doneRounds > 0 ? `${doneRounds}라운드까지 보기` : '지금까지 보기', onClick: () => setViewPartial(true), variant: 'text' }
              : undefined
          }
        />
      </div>
    )
  }

  if (!current) {
    // 1R 첫 발언 대기(진행 막대 없이 캐릭터 대기 표정, §6 검수 반영)
    const first = memberOf(debate, 'A')
    return (
      <div className={styles.page}>
        {header}
        <WaitingNotice elapsed={elapsed} onRetry={refetch}>
          <Character character={first.character} size={160} />
          <p className={`ts-body-15-m ${styles.sub}`}>{withIGa(first.name)} 1R 주장을 준비하고 있어요</p>
        </WaitingNotice>
      </div>
    )
  }

  const member = memberOf(debate, current.side)
  const reason = `${withIGa(nextMember.name)} ${nextRound}R ${ROUND_NAMES[nextRound - 1]} 준비 중이에요`
  const nextDisabled = typing.done && !nextAvailable && !isLast

  return (
    <div className={styles.page}>
      {header}
      <p className="sr-only" aria-live="polite">
        {current.round}R {ROUND_NAMES[current.round - 1]} · {member.name} 발언
      </p>
      <section
        className={styles.stage}
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
        aria-label="무대"
      >
        <div key={current.id} className={styles.speaker}>
          <Character character={current.character} size={160} alt={member.name} className={styles.speakerImg} />
          <div className={styles.name}>
            <span className={styles.sideTag}>
              {current.side} {topicOf(debate, current.side)} 편
            </span>
            <span className={`ts-body-14-m ${styles.sub}`}>
              {member.name} · {member.ai}
            </span>
          </div>
        </div>

        <p className={`ts-body-15-r ${styles.text}`}>
          <span className="sr-only">{current.text}</span>
          <span aria-hidden="true">{typing.shown}</span>
        </p>
        {typing.done && <CaptionBox caption={current.caption} />}

        <div className={styles.gap24} />

        {!isLast && (
          <div className={styles.next}>
            <Character character={nextMember.character} size={32} />
            <p className={`ts-body-14-r ${styles.sub}`}>
              {nextDisabled ? reason : `다음 차례 · ${nextMember.name} (${nextSide} ${topicOf(debate, nextSide)} 편)`}
            </p>
          </div>
        )}
        {waiting && <WaitingNotice elapsed={elapsed} onRetry={refetch} compact />}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.empathy}
            icon={<Heart size={20} weight={empathized.has(current.id) ? 'fill' : 'regular'} className={empathized.has(current.id) ? styles.heartOn : undefined} />}
            aria-pressed={empathized.has(current.id)}
            aria-label={`공감 ${current.empathy_count}`}
            onClick={() => onEmpathy(current)}
          >
            공감 {current.empathy_count}
          </Button>
          <Button className={styles.nextButton} softDisabled={nextDisabled} aria-describedby={nextDisabled ? 'next-reason' : undefined} onClick={onNext}>
            {isLast && typing.done ? '결과 보기' : '다음 발언'}
          </Button>
          {nextDisabled && (
            <span id="next-reason" className="sr-only">
              {reason}
            </span>
          )}
        </div>

        <PastUtterances items={items.slice(0, index)} nameOf={nameOf} />
      </section>
    </div>
  )
}

function WaitingNotice({
  elapsed,
  onRetry,
  compact,
  children,
}: {
  elapsed: number
  onRetry: () => void
  compact?: boolean
  children?: React.ReactNode
}) {
  if (elapsed >= STALLED_AFTER_S) {
    return (
      <div className={styles.inlineError} role="alert">
        <p className="ts-body-15-m">토론이 잠깐 멈췄어요. 다시 시도하면 이어서 만들어요.</p>
        <Button variant="secondary" size="m" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    )
  }
  return (
    <div className={compact ? styles.waitCompact : styles.wait}>
      {children}
      {elapsed >= SLOW_AFTER_S && (
        <p className={`ts-body-14-r ${styles.sub}`} role="status">
          생각보다 오래 걸리고 있어요
        </p>
      )}
    </div>
  )
}
