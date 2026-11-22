import { useCallback, useId, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CaretLeft, Heart, Pause, Play } from '@phosphor-icons/react'
import { ApiError } from '../api/client'
import type { DebateDetail, Utterance, UtteranceList } from '../api/types'
import { Button } from '../components/Button'
import { Character } from '../components/Character'
import { LoadError } from '../components/LoadError'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../components/toastContext'
import { memberOf, titleOf, topicOf } from '../features/debate/cast'
import { HiddenDebate } from '../features/debate/HiddenDebate'
import { useDebateDetail } from '../features/debate/queries'
import { CaptionBox } from '../features/stage/CaptionBox'
import { useAutoAdvance, useEmpathyOnce, useWaitElapsed } from '../features/stage/hooks'
import { completedRounds, roundOf, speakerOf } from '../features/stage/order'
import { PAUSED_TITLE, PausedBlock } from '../features/stage/PausedBlock'
import { PastUtterances } from '../features/stage/PastUtterances'
import { useRetry, useUtterances } from '../features/stage/queries'
import { retryErrorMessage } from '../features/stage/retryMessage'
import { ROUND_NAMES, StepperBar } from '../features/stage/StepperBar'
import { TypedText } from '../features/stage/TypedText'
import { withIGa } from '../lib/korean'
import { useReducedMotion } from '../lib/useReducedMotion'
import { getViewChoice } from '../lib/viewState'
import styles from './StagePage.module.css'

export const AUTO_ADVANCE_MS = 2500 // 다시보기: 자막이 뜬 뒤 다음 발언까지
export const SLOW_AFTER_S = 30 // §8 대기 30초 → "생각보다 오래 걸리고 있어요"
export const STALLED_AFTER_S = 60 // §8 대기 60초 → Error Inline + [다시 시도]

const isHiddenError = (e: unknown) => e instanceof ApiError && e.code === 'hidden'
const isNetworkError = (e: unknown) => e instanceof ApiError && e.isNetwork

/** DEB_01_002 무대 (멈춤 DEB_01_007, 가려짐 DEB_01_008) */
export function StagePage() {
  const { id = '' } = useParams()
  const detail = useDebateDetail(id)
  const utterances = useUtterances(id, detail.data ? !detail.data.hidden : false)

  // 이미 받은 데이터가 있으면, 폴링 중 잠깐의 실패로 무대를 지우지 않는다(다음 폴링에 맡김). 가려짐(410)만 예외.
  if (!detail.data && detail.isError) return <LoadError error={detail.error} onRetry={() => detail.refetch()} />
  if (detail.data?.hidden || isHiddenError(utterances.error)) return <HiddenDebate />
  if (!utterances.data && utterances.isError) return <LoadError error={utterances.error} onRetry={() => utterances.refetch()} />
  if (!detail.data || !utterances.data) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height={44} width="60%" />
        <Skeleton height={320} radius={24} />
      </div>
    )
  }
  return (
    <Stage
      debate={detail.data}
      list={utterances.data}
      refetch={() => utterances.refetch()}
      offline={isNetworkError(utterances.error)}
    />
  )
}

/** offline: 받은 발언은 그대로 두고, 다음 발언을 기다리는 자리에만 COM_01_002를 보인다(보던 라운드 유지). */
type StageProps = { debate: DebateDetail; list: UtteranceList; refetch: () => Promise<unknown>; offline: boolean }

function Stage({ debate, list, refetch, offline }: StageProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const reduced = useReducedMotion()
  const retry = useRetry(debate.id)
  const empathy = useEmpathyOnce(debate.id)
  const reasonId = useId()

  const items = list.items
  const [index, setIndex] = useState(0)
  const [autoplay] = useState(() => list.status === 'done') // 다 만들어진 토론은 다시보기 자동 진행
  const [userPaused, setUserPaused] = useState(false)
  const [hold, setHold] = useState(false) // 마우스·포커스를 올리면 멈춤(17장)
  const [viewPartial, setViewPartial] = useState(false)
  const [typedId, setTypedId] = useState<number | null>(null) // 타자가 끝난 발언
  const [revealId, setRevealId] = useState<number | null>(null) // [다음 발언]으로 즉시 완성한 발언
  const [checking, setChecking] = useState(false) // 60초 안내에서 사용자가 누른 새로고침 진행 중

  const current: Utterance | undefined = items[Math.min(index, items.length - 1)]
  const typed = current !== undefined && typedId === current.id
  const nextAvailable = index + 1 < items.length
  const isLast = current?.seq === list.total
  const atEnd = !nextAvailable && typed
  const nextSeq = (current?.seq ?? 0) + 1
  const nextSide = speakerOf(nextSeq)
  const nextMember = memberOf(debate, nextSide)
  const nextRound = roundOf(nextSeq)

  const waiting = list.status === 'generating' && (items.length === 0 || (atEnd && !isLast))
  const showPaused = list.status === 'paused' && (items.length === 0 || !viewPartial || (atEnd && !isLast))
  const wait = useWaitElapsed(waiting)

  const advance = useCallback(() => setIndex((i) => i + 1), [])
  useAutoAdvance(autoplay && !userPaused && !hold && typed && nextAvailable, AUTO_ADVANCE_MS, advance, index)
  const onTyped = useCallback((uid: number) => setTypedId(uid), [])

  const resultPath = `/debates/${encodeURIComponent(debate.id)}/result`
  const canJumpToResult = getViewChoice(debate.id) !== null

  const onNext = () => {
    if (!current) return
    if (!typed) return setRevealId(current.id)
    if (nextAvailable) return advance()
    if (isLast) navigate(resultPath)
  }

  const onRetry = async () => {
    if (retry.isPending) return // 연타 방지
    try {
      await retry.mutateAsync()
      setViewPartial(true)
    } catch (e) {
      const message = retryErrorMessage(e)
      if (message === null) void refetch()
      else toast.show(message)
    }
  }

  // 60초 안내의 [다시 시도]: 생성 중이라 재시도 API 대상이 아니므로, 기다린 시간을 다시 재고 목록을 새로 읽는다
  // (서버는 멈춘 생성 작업을 이 요청에서 다시 깨운다 — needs_kick). Q-012
  const onRefresh = () => {
    if (checking) return
    wait.reset()
    setChecking(true)
    void refetch().finally(() => setChecking(false))
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
    return (
      <div className={styles.page}>
        {header}
        <PausedBlock
          doneRounds={completedRounds(items.length)}
          hasUtterances={items.length > 0}
          retrying={retry.isPending}
          onRetry={onRetry}
          onViewPartial={viewPartial ? undefined : () => setViewPartial(true)}
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
        <WaitingNotice elapsed={wait.elapsed} refreshing={checking} onRefresh={onRefresh} offline={offline}>
          <Character character={first.character} size={160} />
          <p className={`ts-body-15-m ${styles.sub}`}>{withIGa(first.name)} 1R 주장을 준비하고 있어요</p>
        </WaitingNotice>
      </div>
    )
  }

  const member = memberOf(debate, current.side)
  const reason = `${withIGa(nextMember.name)} ${nextRound}R ${ROUND_NAMES[nextRound - 1]} 준비 중이에요`
  const nextDisabled = typed && !nextAvailable && !isLast
  const pressed = empathy.pressed.has(current.id)

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

        <TypedText
          key={current.id}
          text={current.text}
          utteranceId={current.id}
          instant={reduced || revealId === current.id}
          onDone={onTyped}
          className={`ts-body-15-r ${styles.text}`}
        />
        {typed && <CaptionBox caption={current.caption} />}

        <div className={styles.gap24} />

        {!isLast && (
          <div className={styles.next}>
            <Character character={nextMember.character} size={32} />
            <p className={`ts-body-14-r ${styles.sub}`}>
              {nextDisabled ? reason : `다음 차례 · ${nextMember.name} (${nextSide} ${topicOf(debate, nextSide)} 편)`}
            </p>
          </div>
        )}
        {waiting && <WaitingNotice elapsed={wait.elapsed} refreshing={checking} onRefresh={onRefresh} offline={offline} compact />}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.empathy}
            icon={<Heart size={20} weight={pressed ? 'fill' : 'regular'} className={pressed ? styles.heartOn : undefined} />}
            aria-pressed={pressed}
            aria-label={`공감 ${current.empathy_count}`}
            onClick={() => empathy.press(current.id)}
          >
            공감 {current.empathy_count}
          </Button>
          <Button
            className={styles.nextButton}
            softDisabled={nextDisabled}
            aria-describedby={nextDisabled ? reasonId : undefined}
            onClick={onNext}
          >
            {isLast && typed ? '결과 보기' : '다음 발언'}
          </Button>
          {nextDisabled && (
            <span id={reasonId} className="sr-only">
              {reason}
            </span>
          )}
        </div>

        <PastUtterances items={items.slice(0, index)} nameOf={(u) => memberOf(debate, u.side).name} />
      </section>
    </div>
  )
}

function WaitingNotice({
  elapsed,
  refreshing,
  onRefresh,
  compact,
  offline,
  children,
}: {
  elapsed: number
  refreshing: boolean
  onRefresh: () => void
  compact?: boolean
  offline: boolean
  children?: ReactNode
}) {
  if (offline) {
    // COM_01_002 — 폴링은 계속 돌아서 연결이 돌아오면 저절로 이어진다. 버튼은 바로 확인하고 싶을 때.
    return (
      <div className={styles.inlineError} role="alert">
        <p className="ts-body-15-m">인터넷 연결이 끊겼어요. 연결되면 보던 라운드부터 이어서 보여 드려요.</p>
        <Button variant="secondary" size="m" softDisabled={refreshing} onClick={onRefresh}>
          {refreshing ? '다시 확인하는 중…' : '다시 시도'}
        </Button>
      </div>
    )
  }
  if (elapsed >= STALLED_AFTER_S) {
    return (
      <div className={styles.inlineError} role="alert">
        <p className="ts-body-15-m">{PAUSED_TITLE}. 다시 시도하면 이어서 만들어요.</p>
        <Button variant="secondary" size="m" softDisabled={refreshing} onClick={onRefresh}>
          {refreshing ? '다시 확인하는 중…' : '다시 시도'}
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
