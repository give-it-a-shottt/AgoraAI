import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Result } from '../api/types'
import { ToastProvider } from '../components/Toast'
import { mockApi } from '../test/fetchMock'
import { debate } from '../test/fixtures'
import { renderRoute } from '../test/render'
import { ResultPage } from './ResultPage'

afterEach(() => vi.unstubAllGlobals())

const detail = { ...debate(), hidden: false, utterance_count: 6 }

function result(over: Partial<Result> = {}): Result {
  return {
    judge_status: 'done',
    winner: 'B',
    judge_reason: 'B가 배달 시간 반박에 끝까지 답을 못 받았어요.',
    my_prediction: 'B',
    audience: { count: 3, a_ratio: null, b_ratio: null },
    metrics: { rebut_rate: 0.78, agree_rate: 0.12, human_agreement: null },
    ...over,
  }
}

function setup(body: object, extra?: (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined, status = 200) {
  const fetchFn = mockApi((url, init) => {
    const hit = extra?.(url, init)
    if (hit) return hit
    if (url.pathname === '/api/debates/d1') return { body: detail }
    if (url.pathname === '/api/debates/d1/result') return { status, body }
  })
  const utils = renderRoute(
    [
      { path: '/debates/:id/result', element: <ToastProvider><ResultPage /></ToastProvider> },
      { path: '/debates/:id/stage', element: <div>stage</div> },
      { path: '/', element: <div>home</div> },
    ],
    '/debates/d1/result',
  )
  return { fetchFn, ...utils }
}

describe('ResultPage (DEB_01_003)', () => {
  it('승자·이유·적중·지표를 보여 준다', async () => {
    setup(result())
    expect(await screen.findByRole('heading', { name: 'B 평생 짬뽕 승' })).toBeInTheDocument()
    expect(screen.getByText('B가 배달 시간 반박에 끝까지 답을 못 받았어요.')).toBeInTheDocument()
    expect(screen.getByText('맞혔어요!')).toBeInTheDocument()
    expect(screen.getByText('관객 3명 참여')).toBeInTheDocument()
    expect(screen.getByText('5명부터 관객 판정도 보여요')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
  })

  it('빗나감·예측 없음·관객 5명 이상', async () => {
    setup(result({ my_prediction: 'A', audience: { count: 8, a_ratio: 0.625, b_ratio: 0.375 } }))
    expect(await screen.findByText('아쉽게 빗나갔어요')).toBeInTheDocument()
    expect(screen.getByText(/관객 예측\s+A 평생 짜장 63% · B 평생 짬뽕 38%/)).toBeInTheDocument()
  })

  it('예측 없이 봤으면 다음엔 예측해 보라고', async () => {
    setup(result({ my_prediction: null }))
    expect(await screen.findByText('다음엔 예측해 보세요')).toBeInTheDocument()
  })

  it('판정 중이면 준비 중 안내, 지표·공유는 숨김', async () => {
    setup(result({ judge_status: 'pending', winner: null, judge_reason: null }))
    expect(await screen.findByRole('heading', { name: '판정 준비 중' })).toBeInTheDocument()
    expect(screen.getByText('판정을 기다리는 중')).toBeInTheDocument()
    expect(screen.queryByText('이번 토론, 제대로 싸웠을까?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '무대로 돌아가기' })).toBeInTheDocument()
  })

  it('판정 실패(DEB_01_009)면 다시 요청해 결과를 받는다', async () => {
    const { fetchFn } = setup(result({ judge_status: 'failed', winner: null, judge_reason: null }), (url, init) => {
      if (url.pathname === '/api/debates/d1/judge/retry' && init.method === 'POST') return { body: result() }
    })
    expect(await screen.findByText('판정을 아직 못 냈어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '판정 다시 요청' }))
    expect(await screen.findByRole('heading', { name: 'B 평생 짬뽕 승' })).toBeInTheDocument()
    expect(fetchFn.mock.calls.some((c) => String(c[0]).endsWith('/judge/retry'))).toBe(true)
  })

  it('[어떻게 쟀나요?] 팝업 — Esc로 닫으면 버튼으로 포커스가 돌아온다', async () => {
    setup(result())
    const how = await screen.findByRole('button', { name: '어떻게 쟀나요?' })
    await userEvent.click(how)
    const dialog = screen.getByRole('dialog', { name: '어떻게 쟀나요?' })
    expect(within(dialog).getByText('제대로 맞붙은 발언 78%')).toBeInTheDocument()
    expect(within(dialog).getByText(/아직 재는 중이에요/)).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(how).toHaveFocus()
  })

  it('신고 — 이유를 골라야 보낼 수 있고, 가려지면 알린다', async () => {
    const { fetchFn } = setup(result(), (url, init) => {
      if (url.pathname === '/api/debates/d1/reports' && init.method === 'POST') return { body: { reported: true, hidden: true } }
    })
    await userEvent.click(await screen.findByRole('button', { name: '이 토론 신고하기' }))
    const dialog = screen.getByRole('dialog', { name: '이 토론 신고하기' })
    const submit = within(dialog).getByRole('button', { name: '신고하기' })
    expect(submit).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(within(dialog).getByRole('radio', { name: '성적인 내용' }))
    await userEvent.click(submit)
    expect(await screen.findByText('신고가 쌓여 이 토론을 가렸어요.')).toBeInTheDocument()
    const post = fetchFn.mock.calls.find((c) => String(c[0]).endsWith('/reports'))
    expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({ reason: 'sexual' })
  })

  it('아직 안 끝난 토론이면 무대로 안내', async () => {
    setup({ detail: { code: 'not_finished', message: 'x' } }, undefined, 409)
    expect(await screen.findByRole('heading', { name: '아직 토론이 끝나지 않았어요' })).toBeInTheDocument()
  })

  it('가려진 토론이면 DEB_01_008', async () => {
    setup({ detail: { code: 'hidden', message: 'x' } }, undefined, 410)
    expect(await screen.findByRole('heading', { name: '신고가 많아 가려 둔 토론이에요' })).toBeInTheDocument()
  })
})

describe('ResultPage 예외 경로', () => {
  it('다시 요청한 판정이 또 실패하면 알려 준다', async () => {
    let status: Result['judge_status'] = 'failed'
    setup(
      {},
      (url, init) => {
        if (url.pathname === '/api/debates/d1/result') return { body: result({ judge_status: status, winner: null, judge_reason: null }) }
        if (url.pathname === '/api/debates/d1/judge/retry' && init.method === 'POST') {
          status = 'failed' // 백그라운드 판정이 또 실패
          return { body: result({ judge_status: 'pending', winner: null, judge_reason: null }) }
        }
      },
    )
    await userEvent.click(await screen.findByRole('button', { name: '판정 다시 요청' }))
    expect(await screen.findByText('아직 판정하지 못했어요. 잠시 뒤 다시 눌러 주세요.', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('판정 시도 상한이면 버튼을 숨기고 안내', async () => {
    setup(result({ judge_status: 'failed', winner: null, judge_reason: null }), (url, init) => {
      if (url.pathname === '/api/debates/d1/judge/retry' && init.method === 'POST')
        return { status: 409, body: { detail: { code: 'judge_limit', message: '판정을 더 시도할 수 없어요.' } } }
    })
    await userEvent.click(await screen.findByRole('button', { name: '판정 다시 요청' }))
    expect(await screen.findByText('판정을 더 시도할 수 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '판정 다시 요청' })).not.toBeInTheDocument()
  })

  it('신고가 실패하면 팝업을 두고 알린다, 다시 열면 선택이 비어 있다', async () => {
    setup(result(), (url, init) => {
      if (url.pathname === '/api/debates/d1/reports' && init.method === 'POST')
        return { status: 429, body: { detail: { code: 'too_many_requests', message: '잠시 뒤에 다시 시도해 주세요.', retry_after: 9 } } }
    })
    await userEvent.click(await screen.findByRole('button', { name: '이 토론 신고하기' }))
    await userEvent.click(screen.getByRole('radio', { name: '기타' }))
    await userEvent.click(screen.getByRole('button', { name: '신고하기' }))
    expect(await screen.findByText('잠시 뒤에 다시 시도해 주세요.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await userEvent.click(screen.getByRole('button', { name: '이 토론 신고하기' }))
    expect(screen.getByRole('radio', { name: '기타' })).not.toBeChecked()
  })

  it('결과를 못 불러오면 LoadError', async () => {
    setup({ detail: { code: 'internal', message: '잠시 후 다시 시도해 주세요.' } }, undefined, 500)
    expect(await screen.findByRole('heading', { name: '잠시 문제가 생겼어요' })).toBeInTheDocument()
  })
})
