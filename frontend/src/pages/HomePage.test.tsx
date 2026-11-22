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
