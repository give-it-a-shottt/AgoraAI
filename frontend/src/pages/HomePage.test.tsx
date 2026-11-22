import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/render'
import { mockApi } from '../test/fetchMock'
import { debate } from '../test/fixtures'
import { HomePage } from './HomePage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const list = (items: ReturnType<typeof debate>[], page = 1, total_pages = 1) => ({
  items,
  page,
  total_pages,
  total: items.length,
})

describe('HomePage (HOM_01_001)', () => {
  it('오늘의 토론과 목록을 보여 주고 승자는 없다', async () => {
    mockApi((url) => {
      if (url.pathname === '/api/debates/today') return { body: debate() }
      if (url.pathname === '/api/debates')
        return { body: list([debate({ id: 'd2', topic_a: '탕수육 부먹', topic_b: '찍먹', status: 'generating', prediction_count: 41 })]) }
    })
    renderPage(<HomePage />)
    expect(await screen.findByRole('heading', { name: '평생 짜장 vs 평생 짬뽕' })).toBeInTheDocument()
    expect(screen.getByText('냥냥이 · 평생 짜장 편 · HyperCLOVA X')).toBeInTheDocument()
    expect(screen.getByText('관객 128명이 예측했어요')).toBeInTheDocument()
    const row = await screen.findByRole('link', { name: /탕수육 부먹 vs 찍먹/ })
    expect(within(row).getByText('진행 중')).toBeInTheDocument()
    expect(within(row).getByText(/관객 41명 예측 · 오늘/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/승리|이겼|winner/)
  })

  it('탭을 바꾸면 최신순을 요청한다', async () => {
    const fetchFn = mockApi((url) => {
      if (url.pathname === '/api/debates/today') return { body: debate() }
      if (url.pathname === '/api/debates') return { body: list([]) }
    })
    renderPage(<HomePage />)
    await userEvent.click(await screen.findByRole('tab', { name: '최신' }))
    expect(screen.getByRole('tab', { name: '최신' })).toHaveAttribute('aria-selected', 'true')
    const urls = fetchFn.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('sort=latest'))).toBe(true)
  })

  it('방금 만든 토론이 있으면 한 줄 보여 준다', async () => {
    localStorage.setItem('agora.recentDebate', JSON.stringify({ id: 'mine', topic_a: '산', topic_b: '바다' }))
    mockApi((url) => {
      if (url.pathname === '/api/debates/today') return { body: debate() }
      if (url.pathname === '/api/debates') return { body: list([]) }
    })
    renderPage(<HomePage />)
    expect(await screen.findByRole('link', { name: /방금 만든 토론\s*산 vs 바다/ })).toHaveAttribute('href', '/debates/mine')
  })

  it('토론이 하나도 없으면 빈 상태(HOM_01_002)', async () => {
    mockApi((url) => {
      if (url.pathname === '/api/debates/today')
        return { status: 404, body: { detail: { code: 'no_today', message: '없음' } } }
    })
    const { router } = renderPage(<HomePage />)
    expect(await screen.findByRole('heading', { name: '아직 토론이 없어요' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '산 vs 바다' }))
    expect(router.state.location.pathname).toBe('/create')
    expect(router.state.location.search).toContain('a=%EC%82%B0')
  })

  it('불러오기 실패면 다시 시도 안내', async () => {
    mockApi(() => ({ status: 500, body: { detail: { code: 'internal', message: 'x' } } }))
    renderPage(<HomePage />)
    expect(await screen.findByRole('heading', { name: '토론을 불러오지 못했어요' })).toBeInTheDocument()
  })
})

describe('HomePage 목록 예외·페이지', () => {
  const today = () => ({ body: debate() })

  it('목록만 실패하면 목록 자리에 다시 시도', async () => {
    mockApi((url) => {
      if (url.pathname === '/api/debates/today') return today()
      if (url.pathname === '/api/debates') return { status: 500, body: { detail: { code: 'internal', message: 'x' } } }
    })
    renderPage(<HomePage />)
    expect(await screen.findByText('목록을 불러오지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('목록이 비면 안내 문구', async () => {
    mockApi((url) => {
      if (url.pathname === '/api/debates/today') return today()
      if (url.pathname === '/api/debates') return { body: list([]) }
    })
    renderPage(<HomePage />)
    expect(await screen.findByText('아직 다른 토론이 없어요.')).toBeInTheDocument()
  })

  it('로딩 중에는 Skeleton(aria-busy)', async () => {
    mockApi((url) => {
      if (url.pathname === '/api/debates/today') return today()
      return undefined
    })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/today')
        ? Promise.resolve(new Response(JSON.stringify(debate()), { status: 200 }))
        : new Promise(() => {}),
    ))
    renderPage(<HomePage />)
    expect(await screen.findByLabelText('토론 목록 불러오는 중')).toHaveAttribute('aria-busy', 'true')
  })

  it('PC 번호를 누르면 page 파라미터로 요청', async () => {
    const fetchFn = mockApi((url) => {
      if (url.pathname === '/api/debates/today') return today()
      if (url.pathname === '/api/debates') {
        const page = Number(url.searchParams.get('page'))
        return { body: list([debate({ id: `p${page}`, topic_a: `주제${page}`, topic_b: '비교' })], page, 3) }
      }
    })
    const { router } = renderPage(<HomePage />)
    await userEvent.click(await screen.findByRole('button', { name: '2' }))
    expect(router.state.location.search).toContain('page=2')
    expect(await screen.findByRole('link', { name: /주제2 vs 비교/ })).toBeInTheDocument()
    expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('page=2'))).toBe(true)
  })

  it('MO에서는 더보기로 다음 페이지를 이어 붙인다', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
    }))
    mockApi((url) => {
      if (url.pathname === '/api/debates/today') return today()
      if (url.pathname === '/api/debates') {
        const page = Number(url.searchParams.get('page'))
        return { body: { items: [debate({ id: `m${page}`, topic_a: `모바일${page}`, topic_b: '비교' })], page, total_pages: 2, total: 2 } }
      }
    })
    renderPage(<HomePage />)
    await userEvent.click(await screen.findByRole('button', { name: /더보기 \(1 \/ 2\)/ }))
    expect(await screen.findByRole('link', { name: /모바일2 vs 비교/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /모바일1 vs 비교/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /더보기/ })).not.toBeInTheDocument()
  })
})
