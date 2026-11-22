import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CaretLeft, CaretRight, Question } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { Button } from '../components/Button'
import { Character } from '../components/Character'
import { Chip } from '../components/Chip'
import { InputField } from '../components/InputField'
import { StateBlock } from '../components/StateBlock'
import { useAuth } from '../features/auth/authContext'
import { titleOf } from '../features/debate/cast'
import { clearDraft, loadDraft, saveDraft } from '../features/create/draft'
import { useCreateDebate, useQuota, useSimilar } from '../features/create/queries'
import { TOPIC_SUGGESTIONS, type TopicPair } from '../features/create/suggestions'
import { saveRecentDebate } from '../lib/recentDebates'
import { TOPIC_MAX, TOPIC_MIN, validateTopic } from '../features/create/validate'
import styles from './CreatePage.module.css'

type Outcome =
  | { kind: 'rejected'; reason: string; suggestions: TopicPair[] }
  | { kind: 'user_limit'; resetAt: string }
  | { kind: 'global_closed' }
  | { kind: 'check_failed' }

const kstTime = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric' }).format(new Date(iso))

/** CRT_01_001 주제 입력 · 002 확인 중 · 003 거절 · 004 내 한도 · 006 전체 마감 · 007 확인 실패 (로그인은 COM_01_001) */
export function CreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const auth = useAuth()
  const [form, setForm] = useState(() => {
    const fromUrl = { a: params.get('a') ?? '', b: params.get('b') ?? '' }
    return fromUrl.a || fromUrl.b ? fromUrl : loadDraft()
  })
  const [touched, setTouched] = useState({ a: false, b: false })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const quota = useQuota(auth.user !== null)
  const similar = useSimilar(form.a, form.b)
  const create = useCreateDebate()

  useEffect(() => saveDraft(form), [form]) // 로그인하러 다녀와도·닫아도 입력 유지

  const errors = { a: validateTopic(form.a), b: validateTopic(form.b) }
  const fill = (t: TopicPair) => {
    setForm({ a: t.a, b: t.b })
    setOutcome(null)
  }

  const start = async () => {
    setTouched({ a: true, b: true })
    if (errors.a || errors.b) return
    if (!auth.user) return auth.openLogin('/create')
    try {
      const { id } = await create.mutateAsync({ topic_a: form.a.trim(), topic_b: form.b.trim() })
      saveRecentDebate({ id, topic_a: form.a.trim(), topic_b: form.b.trim() })
      clearDraft()
      void qc.invalidateQueries({ queryKey: ['me', 'quota'] })
      navigate(`/debates/${encodeURIComponent(id)}`)
    } catch (e) {
      if (!(e instanceof ApiError)) return setOutcome({ kind: 'check_failed' })
      if (e.status === 401) return auth.openLogin('/create')
      if (e.code === 'topic_rejected')
        return setOutcome({ kind: 'rejected', reason: e.message, suggestions: (e.extra.suggestions as TopicPair[]) ?? [] })
      if (e.code === 'user_limit') return setOutcome({ kind: 'user_limit', resetAt: String(e.extra.reset_at ?? '') })
      if (e.code === 'global_closed') return setOutcome({ kind: 'global_closed' })
      if (e.code === 'topic_invalid') return setTouched({ a: true, b: true })
      setOutcome({ kind: 'check_failed' })
    }
  }

  if (create.isPending) {
    return (
      <div className={styles.state} role="status" aria-live="polite">
        <Character character="owl" size={160} />
        <span className={styles.spinner} aria-hidden="true" />
        <p className="ts-headline-20">주제를 확인하고 있어요</p>
        <p className={`ts-body-15-r ${styles.sub}`}>토론하기 괜찮은 주제인지 심판 부엉이가 살펴보는 중이에요.</p>
      </div>
    )
  }
  if (outcome?.kind === 'rejected') {
    return (
      <StateBlock
        character="owl"
        title="이 주제로는 토론하기 어려워요"
        description={`${outcome.reason} 횟수는 줄지 않았어요.`}
        primary={{ label: '주제 다시 쓰기', onClick: () => setOutcome(null) }}
      >
        <div className={styles.chips}>
          {outcome.suggestions.map((t) => (
            <Chip key={`${t.a}|${t.b}`} onClick={() => fill(t)}>
              {titleOf({ topic_a: t.a, topic_b: t.b })}
            </Chip>
          ))}
        </div>
      </StateBlock>
    )
  }
  // §0-5 Flow B: 로그인 뒤 남은 횟수가 없으면 입력 전에 바로 CRT_01_004
  const limitReset =
    outcome?.kind === 'user_limit' ? outcome.resetAt : auth.user && quota.data?.remaining === 0 ? quota.data.reset_at : null
  if (limitReset !== null) {
    return (
      <StateBlock
        character="cat"
        title="오늘 만들 수 있는 토론을 다 썼어요"
        description={limitReset ? `${kstTime(limitReset)}부터 다시 만들 수 있어요. 그동안 오늘의 토론을 봐 주세요.` : '내일 다시 만들 수 있어요.'}
        primary={{ label: '오늘의 토론 보기', onClick: () => navigate('/') }}
      />
    )
  }
  if (outcome?.kind === 'global_closed') {
    return (
      <StateBlock
        character="penguin"
        title="오늘은 토론 생성이 마감됐어요"
        description="오늘 준비한 AI 사용량을 다 썼어요. 내 남은 횟수와는 별개예요. 내일 다시 만들어 주세요."
        primary={{ label: '오늘의 토론 보기', onClick: () => navigate('/') }}
      />
    )
  }
  if (outcome?.kind === 'check_failed') {
    return (
      <StateBlock
        character="owl"
        title="주제를 확인하지 못했어요"
        description="잠깐 연결이 고르지 않았어요. 횟수는 줄지 않았어요."
        primary={{ label: '다시 시도', onClick: () => void start() }}
        secondary={{ label: '주제 고치기', onClick: () => setOutcome(null), variant: 'text' }}
      />
    )
  }

  const found = similar.data?.debate
  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        <CaretLeft size={18} aria-hidden="true" />
        <span className="ts-body-14-m">홈으로</span>
      </Link>
      <header className={styles.head}>
        <h1 className="ts-headline-32">어떤 밸런스 게임을 붙여 볼까요?</h1>
        <p className={`ts-body-15-r ${styles.sub}`}>두 선택지를 쓰면 냥냥이와 펭펭이가 3라운드로 토론해요.</p>
      </header>

      <section className={styles.suggest} aria-labelledby="suggest-title">
        <p id="suggest-title" className={`ts-caption-13-m ${styles.sub}`}>
          추천 주제
        </p>
        <div className={styles.chips}>
          {TOPIC_SUGGESTIONS.slice(0, 3).map((t) => (
            <Chip key={`${t.a}|${t.b}`} onClick={() => fill(t)}>
              {titleOf({ topic_a: t.a, topic_b: t.b })}
            </Chip>
          ))}
        </div>
      </section>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void start()
        }}
        noValidate
      >
        <InputField
          label="A 선택지"
          placeholder="예) 평생 짜장"
          value={form.a}
          maxLength={TOPIC_MAX}
          helper={`${TOPIC_MIN}~${TOPIC_MAX}자`}
          error={touched.a ? errors.a : null}
          onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, a: true }))}
        />
        <p className={styles.vs} aria-hidden="true">
          vs
        </p>
        <InputField
          label="B 선택지"
          placeholder="예) 평생 짬뽕"
          value={form.b}
          maxLength={TOPIC_MAX}
          helper={`${TOPIC_MIN}~${TOPIC_MAX}자`}
          error={touched.b ? errors.b : null}
          onChange={(e) => setForm((f) => ({ ...f, b: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, b: true }))}
        />
        {found && (
          <div className={styles.similar} role="status">
            <p className={styles.similarTitle}>
              <Question size={20} aria-hidden="true" /> 비슷한 토론이 이미 있어요
            </p>
            <p className={`ts-body-14-r ${styles.sub}`}>‘{titleOf(found)}’와 같은 주제예요</p>
            <Link to={`/debates/${encodeURIComponent(found.id)}`} className={styles.similarLink}>
              <CaretRight size={20} aria-hidden="true" />
              <span className="ts-label-14">그 토론 보러 가기</span>
            </Link>
          </div>
        )}

        <div className={styles.actions}>
          <div className={styles.remain}>
            {auth.user && quota.data ? (
              <p className={`ts-body-14-m ${styles.sub}`}>
                오늘 남은 횟수 {quota.data.remaining} / {quota.data.limit}
              </p>
            ) : (
              <p className={`ts-body-14-m ${styles.sub}`}>{auth.user ? '남은 횟수를 확인하는 중…' : '토론을 만들려면 로그인이 필요해요'}</p>
            )}
            <p className={`ts-caption-12-r ${styles.weak}`}>주제 확인에서 거절되면 줄지 않아요</p>
          </div>
          <Button type="submit" className={styles.submit}>
            {auth.user ? '토론 시작' : '로그인하고 토론 시작'}
          </Button>
        </div>
      </form>
    </div>
  )
}
