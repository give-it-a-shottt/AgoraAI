import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { mockApi } from '../test/fetchMock'
import { debate } from '../test/fixtures'
import { renderRoute } from '../test/render'
import { getViewChoice } from '../lib/viewState'
import { PredictPage } from './PredictPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const detail = (over = {}) => ({ ...debate(), hidden: false, utterance_count: 0, ...over })

function setup(opts: { mine?: 'A' | 'B' | null; detailBody?: object; detailStatus?: number } = {}) {
  const fetchFn = mockApi((url, init) => {
    if (url.pathname === '/api/debates/d1') return { status: opts.detailStatus ?? 200, body: opts.detailBody ?? detail() }
    if (url.pathname === '/api/debates/d1/predictions/me') return { body: { pick: opts.mine ?? null } }
    if (url.pathname === '/api/debates/d1/predictions' && init.method === 'POST') {
      const { pick } = JSON.parse(String(init.body))
      return { body: { pick } }
    }
  })
  const utils = renderRoute(
    [
      { path: '/debates/:id', element: <ToastProvider><PredictPage /></ToastProvider> },
      { path: '/debates/:id/stage', element: <div>stage</div> },
      { path: '/', element: <div>home</div> },
    ],
    '/debates/d1',
  )
  return { fetchFn, ...utils }
}

describe('PredictPage (DEB_01_001)', () => {
  it('주제·카드·출연을 보여 주고, 고르면 예측 저장 후 무대로', async () => {
    const { fetchFn, router } = setup()
    expect(await screen.findByRole('heading', { name: '평생 짜장 vs 평생 짬뽕' })).toBeInTheDocument()
    expect(screen.getByText('냥냥이')).toBeInTheDocument()
    expect(screen.getByText('“근데 그거 아세요?”로 시작해요')).toBeInTheDocument()
    expect(screen.getByText('B 평생 짬뽕 편 · Gemini')).toBeInTheDocument()

    const cta = screen.getByRole('button', { name: '예측하고 보기' })
    expect(cta).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(cta)
    expect(router.state.location.pathname).toBe('/debates/d1')

    await userEvent.click(screen.getByRole('radio', { name: /B\s*평생 짬뽕/ }))
    expect(screen.getByText('내 예측')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '평생 짬뽕으로 예측하고 보기' }))

    expect(router.state.location.pathname).toBe('/debates/d1/stage')
    const postCall = fetchFn.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
    expect(JSON.parse(String((postCall![1] as RequestInit).body))).toEqual({ pick: 'B' })
    expect(getViewChoice('d1')).toBe('B')
  })

  it('예측 없이 보기는 건너뛰기로 기억하고 무대로', async () => {
    const { router } = setup()
    await userEvent.click(await screen.findByRole('button', { name: '예측 없이 보기' }))
    expect(router.state.location.pathname).toBe('/debates/d1/stage')
    expect(getViewChoice('d1')).toBe('skip')
  })

  it('이미 예측했으면 그 값으로 고정하고 이어서 보기', async () => {
    setup({ mine: 'A' })
    expect(await screen.findByRole('button', { name: '이어서 보기' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /A\s*평생 짜장/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /B\s*평생 짬뽕/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '예측 없이 보기' })).not.toBeInTheDocument()
  })

  it('링크 복사하면 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: '링크 복사' }))
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/share/d1'.replace('http://localhost:3000', window.location.origin))
    expect(await screen.findByText('링크를 복사했어요')).toBeInTheDocument()
  })

  it('가려진 토론이면 DEB_01_008', async () => {
    setup({ detailBody: detail({ hidden: true }) })
    expect(await screen.findByRole('heading', { name: '신고가 많아 가려 둔 토론이에요' })).toBeInTheDocument()
  })

  it('없는 토론이면 COM_01_003', async () => {
    setup({ detailStatus: 404, detailBody: { detail: { code: 'not_found', message: '없음' } } })
    expect(await screen.findByRole('heading', { name: '없는 페이지예요' })).toBeInTheDocument()
  })
})

describe('PredictPage 실패 경로', () => {
  it('예측 저장이 실패하면 토스트를 띄우고 머문다', async () => {
    mockApi((url, init) => {
      if (url.pathname === '/api/debates/d1') return { body: detail() }
      if (url.pathname === '/api/debates/d1/predictions/me') return { body: { pick: null } }
      if (init.method === 'POST') return { status: 500, body: { detail: { code: 'internal', message: 'x' } } }
    })
    const { router } = renderRoute(
      [{ path: '/debates/:id', element: <ToastProvider><PredictPage /></ToastProvider> }],
      '/debates/d1',
    )
    await userEvent.click(await screen.findByRole('radio', { name: /A\s*평생 짜장/ }))
    await userEvent.click(screen.getByRole('button', { name: '평생 짜장으로 예측하고 보기' }))
    expect(await screen.findByText('예측을 저장하지 못했어요. 다시 눌러 주세요.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/debates/d1')
  })

  it('서버가 다른 처음 예측을 돌려주면 그 값으로 이어 간다고 알린다', async () => {
    mockApi((url, init) => {
      if (url.pathname === '/api/debates/d1') return { body: detail() }
      if (url.pathname === '/api/debates/d1/predictions/me') return { body: { pick: null } }
      if (init.method === 'POST') return { body: { pick: 'A' } }
    })
    renderRoute(
      [
        { path: '/debates/:id', element: <ToastProvider><PredictPage /></ToastProvider> },
        { path: '/debates/:id/stage', element: <ToastProvider><div>stage</div></ToastProvider> },
      ],
      '/debates/d1',
    )
    await userEvent.click(await screen.findByRole('radio', { name: /B\s*평생 짬뽕/ }))
    await userEvent.click(screen.getByRole('button', { name: '평생 짬뽕으로 예측하고 보기' }))
    expect(getViewChoice('d1')).toBe('A')
  })

  it('인터넷이 끊기면 COM_01_002 안내', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    renderRoute([{ path: '/debates/:id', element: <ToastProvider><PredictPage /></ToastProvider> }], '/debates/d1')
    expect(await screen.findByRole('heading', { name: '인터넷 연결이 끊겼어요' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('복사가 막히면 대신 안내 토스트', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } })
    document.execCommand = vi.fn(() => false)
    setup()
    await userEvent.click(await screen.findByRole('button', { name: '링크 복사' }))
    expect(await screen.findByText('복사하지 못했어요. 주소창의 링크를 써 주세요.')).toBeInTheDocument()
  })

  it('내 예측을 불러오는 동안은 버튼이 비활성', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/me')
        ? new Promise(() => {})
        : Promise.resolve(new Response(JSON.stringify(detail()), { status: 200 })),
    ))
    renderRoute([{ path: '/debates/:id', element: <ToastProvider><PredictPage /></ToastProvider> }], '/debates/d1')
    await userEvent.click(await screen.findByRole('radio', { name: /A\s*평생 짜장/ }))
    expect(screen.getByRole('button', { name: '평생 짜장으로 예측하고 보기' })).toHaveAttribute('aria-disabled', 'true')
  })
})
