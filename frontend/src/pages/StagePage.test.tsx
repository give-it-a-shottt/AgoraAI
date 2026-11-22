import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Utterance, UtteranceList } from '../api/types'
import { ToastProvider } from '../components/Toast'
import { setViewChoice } from '../lib/viewState'
import { mockApi } from '../test/fetchMock'
import { debate } from '../test/fixtures'
import { renderRoute } from '../test/render'
import { AUTO_ADVANCE_MS, StagePage } from './StagePage'

const detail = { ...debate(), hidden: false, utterance_count: 0 }

function utt(seq: number, over: Partial<Utterance> = {}): Utterance {
  const side = seq % 2 === 1 ? 'A' : 'B'
  return {
    id: seq,
    seq,
    round: Math.ceil(seq / 2),
    side,
    character: side === 'A' ? 'cat' : 'penguin',
    text: `${seq}번째 발언이에요.`,
    caption: `자막${seq}`,
    empathy_count: 0,
    ...over,
  }
}

const list = (n: number, status: UtteranceList['status'] = 'done'): UtteranceList => ({
  items: Array.from({ length: n }, (_, i) => utt(i + 1)),
  status,
  total: 6,
})

function stubMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function setup(body: UtteranceList | (() => UtteranceList), extra?: (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined) {
  const fetchFn = mockApi((url, init) => {
    const hit = extra?.(url, init)
    if (hit) return hit
    if (url.pathname === '/api/debates/d1') return { body: detail }
    if (url.pathname === '/api/debates/d1/utterances') return { body: typeof body === 'function' ? body() : body }
  })
  const utils = renderRoute(
    [
      { path: '/debates/:id/stage', element: <ToastProvider><StagePage /></ToastProvider> },
      { path: '/debates/:id/result', element: <div>result page</div> },
      { path: '/debates/:id', element: <div>predict page</div> },
    ],
    '/debates/d1/stage',
  )
  return { fetchFn, ...utils }
}

beforeEach(() => stubMedia(true)) // 기본은 동작 줄이기(타자 효과 즉시)
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('StagePage (DEB_01_002)', () => {
  it('다시보기는 자막 뒤 자동으로 다음 발언, 정지 버튼으로 멈춘다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setup(list(6))
    expect(await screen.findByText('자막1', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('1번째 발언이에요.', { selector: '[aria-hidden="true"]' })).toBeInTheDocument()
    expect(screen.getByText('핵심 한 줄:')).toHaveClass('sr-only')
    expect(screen.getByText('1R 주장 · 냥냥이 발언')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('1R 주장')

    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_ADVANCE_MS + 10) })
    expect(await screen.findByText('자막2', {}, { timeout: 5000 })).toBeInTheDocument()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: '자동 진행 멈춤' }))
    expect(screen.getByRole('button', { name: '자동 진행 재생' })).toHaveAttribute('aria-pressed', 'true')
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_ADVANCE_MS * 2) })
    expect(screen.getByText('자막2')).toBeInTheDocument()
    expect(screen.queryByText('자막3')).not.toBeInTheDocument()
  })

  it('타자 효과 중 [다음 발언]은 즉시 완성, 다시 누르면 다음으로', async () => {
    stubMedia(false)
    setup(list(2, 'generating'))
    const next = await screen.findByRole('button', { name: '다음 발언' })
    expect(screen.queryByText('자막1')).not.toBeInTheDocument()
    await userEvent.click(next)
    expect(screen.getByText('자막1')).toBeInTheDocument()
    expect(screen.getByText('1번째 발언이에요.', { selector: '[aria-hidden="true"]' })).toBeInTheDocument()
    await userEvent.click(next)
    expect(await screen.findByText('2번째 발언이에요.', { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('생성 중 다음 발언이 없으면 이유와 함께 비활성(대기 시계는 hooks.test에서 검증)', async () => {
    setup(list(1, 'generating'))
    await screen.findByText('자막1')
    expect(screen.getByRole('button', { name: '다음 발언' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText('펭펭이가 1R 주장 준비 중이에요').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /자동 진행/ })).not.toBeInTheDocument() // 생성 중엔 자동 진행 없음
  })

  it('첫 발언 전에는 대기 표정', async () => {
    setup(list(0, 'generating'))
    expect(await screen.findByText('냥냥이가 1R 주장을 준비하고 있어요')).toBeInTheDocument()
  })

  it('멈춘 토론은 DEB_01_007 — 보기·다시 시도·대기 안내', async () => {
    let status: UtteranceList['status'] = 'paused'
    const { fetchFn } = setup(
      () => ({ ...list(4), status }),
      (url, init) => {
        if (url.pathname === '/api/debates/d1/retry' && init.method === 'POST') {
          return { status: 429, body: { detail: { code: 'retry_too_soon', message: 'x', retry_after: 42 } } }
        }
      },
    )
    expect(await screen.findByRole('heading', { name: '토론이 잠깐 멈췄어요' })).toBeInTheDocument()
    expect(screen.getByText(/2라운드까지는 완성됐어요/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('42초 뒤에 다시 시도해 주세요.')).toBeInTheDocument()
    expect(fetchFn.mock.calls.some((c) => String(c[0]).endsWith('/retry'))).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: '2라운드까지 보기' }))
    expect(screen.getByText('자막1')).toBeInTheDocument()
    status = 'paused'
  })

  it('마지막 발언 뒤 [결과 보기]로 결과 화면', async () => {
    const { router } = setup(list(6))
    for (let i = 0; i < 5; i++) await userEvent.click(await screen.findByRole('button', { name: '다음 발언' }))
    await userEvent.click(screen.getByRole('button', { name: '결과 보기' }))
    expect(router.state.location.pathname).toBe('/debates/d1/result')
  })

  it('공감은 한 번, 눌림 상태와 수가 바뀐다', async () => {
    const { fetchFn } = setup(list(1, 'generating'), (url, init) => {
      if (url.pathname === '/api/utterances/1/empathy' && init.method === 'POST') return { body: { count: 13, empathized: true } }
    })
    const button = await screen.findByRole('button', { name: '공감 0' })
    await userEvent.click(button)
    expect(await screen.findByRole('button', { name: '공감 13' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '공감 13' }))
    expect(fetchFn.mock.calls.filter((c) => String(c[0]).includes('/empathy'))).toHaveLength(1)
  })

  it('[결과 바로 보기]는 예측·건너뛰기 뒤에만', async () => {
    setup(list(2))
    await screen.findByText('자막1')
    expect(screen.queryByRole('button', { name: '결과 바로 보기' })).not.toBeInTheDocument()
  })

  it('예측했으면 [결과 바로 보기]가 보인다', async () => {
    setViewChoice('d1', 'skip')
    const { router } = setup(list(2))
    await userEvent.click(await screen.findByRole('button', { name: '결과 바로 보기' }))
    expect(router.state.location.pathname).toBe('/debates/d1/result')
  })

  it('지난 발언 펼쳐 보기', async () => {
    setup(list(3, 'generating'))
    await userEvent.click(await screen.findByRole('button', { name: '다음 발언' }))
    await userEvent.click(screen.getByRole('button', { name: '다음 발언' }))
    await userEvent.click(screen.getByRole('button', { name: '지난 발언 2개 펼쳐 보기' }))
    expect(screen.getByText('“자막1”')).toBeInTheDocument()
    expect(screen.getByText('1R 주장 · 냥냥이')).toBeInTheDocument()
  })

  it('가려진 토론(410)이면 DEB_01_008', async () => {
    setup(list(0), (url) => {
      if (url.pathname === '/api/debates/d1/utterances') return { status: 410, body: { detail: { code: 'hidden', message: 'x' } } }
    })
    expect(await screen.findByRole('heading', { name: '신고가 많아 가려 둔 토론이에요' })).toBeInTheDocument()
  })
})

describe('StagePage 예외 경로', () => {
  it('공감이 실패하면 눌림을 되돌리고 알린다', async () => {
    setup(list(1, 'generating'), (url, init) => {
      if (url.pathname === '/api/utterances/1/empathy' && init.method === 'POST')
        return { status: 429, body: { detail: { code: 'too_many_requests', message: 'x', retry_after: 5 } } }
    })
    await userEvent.click(await screen.findByRole('button', { name: '공감 0' }))
    expect(await screen.findByText('공감을 남기지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '공감 0' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('다시 시도했는데 이미 생성 중이면(not_paused) 목록을 다시 읽는다', async () => {
    let calls = 0
    setup(
      () => {
        calls += 1
        return { ...list(2), status: calls === 1 ? 'paused' : 'generating' }
      },
      (url, init) => {
        if (url.pathname === '/api/debates/d1/retry' && init.method === 'POST')
          return { status: 409, body: { detail: { code: 'not_paused', message: 'x' } } }
      },
    )
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('자막1')).toBeInTheDocument()
  })

  it('없는 토론이면 COM_01_003', async () => {
    setup(list(0), (url) => {
      if (url.pathname === '/api/debates/d1') return { status: 404, body: { detail: { code: 'not_found', message: 'x' } } }
    })
    expect(await screen.findByRole('heading', { name: '없는 페이지예요' })).toBeInTheDocument()
  })

  it('폴링 중 잠깐 실패해도 보던 무대를 유지한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let calls = 0
    setup(list(1, 'generating'), (url) => {
      if (url.pathname === '/api/debates/d1/utterances') {
        calls += 1
        if (calls > 1) return { status: 500, body: { detail: { code: 'internal', message: 'x' } } }
      }
    })
    expect(await screen.findByText('자막1')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(screen.getByText('자막1')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '잠시 문제가 생겼어요' })).not.toBeInTheDocument()
  })

  it('폴링 중 인터넷이 끊기면 기다리는 자리에 COM_01_002, 다시 연결되면 이어서', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let calls = 0
    let online = false
    setup(() => (calls >= 2 && online ? list(2, 'generating') : list(1, 'generating')), (url) => {
      if (url.pathname === '/api/debates/d1/utterances') {
        calls += 1
        if (calls > 1 && !online) throw new TypeError('Failed to fetch')
      }
      return undefined
    })
    expect(await screen.findByText('자막1')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(await screen.findByText(/인터넷 연결이 끊겼어요/)).toBeInTheDocument()
    expect(screen.getByText('자막1')).toBeInTheDocument()
    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(screen.queryByText(/인터넷 연결이 끊겼어요/)).not.toBeInTheDocument()
  })
})
