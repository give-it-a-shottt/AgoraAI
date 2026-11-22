import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../features/auth/auth'
import { mockApi } from '../test/fetchMock'
import { renderRoute } from '../test/render'
import { validateTopic } from '../features/create/validate'
import { CreatePage } from './CreatePage'

type Reply = { status?: number; body?: unknown } | undefined

let mockQuotaRemaining = 2

beforeEach(() => {
  mockQuotaRemaining = 2
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

const USER = { user: { id: 1, nickname: '토론러' } }

function setup(opts: { loggedIn?: boolean; create?: () => Reply; similar?: Reply; quota?: Reply; path?: string } = {}) {
  const fetchFn = mockApi((url, init) => {
    if (url.pathname === '/api/auth/me') return { body: opts.loggedIn ? USER : { user: null } }
    if (url.pathname === '/api/auth/providers') return { body: { google: false, kakao: false, dev: true } }
    if (url.pathname === '/api/auth/dev-login') return { body: USER }
    if (url.pathname === '/api/me/quota') return opts.quota ?? { body: { remaining: mockQuotaRemaining, limit: 3, reset_at: '2026-11-22T15:00:00' } }
    if (url.pathname === '/api/debates/similar') return opts.similar ?? { body: { debate: null } }
    if (url.pathname === '/api/debates' && init.method === 'POST') return opts.create?.() ?? { status: 201, body: { id: 'new1' } }
  })
  const page = (
    <ToastProvider>
      <AuthProvider>
        <CreatePage />
      </AuthProvider>
    </ToastProvider>
  )
  const view = renderRoute(
    [
      { path: '/create', element: page },
      { path: '/login-check', element: <ToastProvider><AuthProvider><div>홈 화면</div></AuthProvider></ToastProvider> },
      { path: '/debates/:id', element: <div>예측 화면</div> },
      { path: '/', element: <div>홈 화면</div> },
    ],
    opts.path ?? '/create',
  )
  return { fetchFn, ...view }
}

const posts = (fn: ReturnType<typeof mockApi>) =>
  fn.mock.calls.filter(([u, init]) => String(u).startsWith('/api/debates') && init?.method === 'POST' && !String(u).includes('similar'))

async function fill(a: string, b: string) {
  await userEvent.type(screen.getByLabelText('A 선택지'), a)
  await userEvent.type(screen.getByLabelText('B 선택지'), b)
}

describe('validateTopic', () => {
  it('2~30자, 꺾쇠 금지', () => {
    expect(validateTopic('산')).toMatch('2~30자')
    expect(validateTopic('  등산  ')).toBeNull()
    expect(validateTopic('가'.repeat(31))).toMatch('2~30자')
    expect(validateTopic('짜장<b>')).toMatch('꺾쇠')
    expect(validateTopic('짜장＜b')).toMatch('꺾쇠')
  })
})

describe('CreatePage', () => {
  it('추천 칩을 누르면 입력칸이 채워진다', async () => {
    setup({ loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: '민트초코 vs 반민초' }))
    expect(screen.getByLabelText('A 선택지')).toHaveValue('민트초코')
    expect(screen.getByLabelText('B 선택지')).toHaveValue('반민초')
  })

  it('주소의 a·b로 입력칸을 미리 채운다', async () => {
    setup({ path: `/create?a=${encodeURIComponent('평생 짜장')}&b=${encodeURIComponent('평생 짬뽕')}` })
    expect(await screen.findByLabelText('A 선택지')).toHaveValue('평생 짜장')
    expect(screen.getByLabelText('B 선택지')).toHaveValue('평생 짬뽕')
  })

  it('길이가 맞지 않으면 칸을 벗어날 때 오류를 보이고 요청하지 않는다', async () => {
    const { fetchFn } = setup({ loggedIn: true })
    await screen.findByText('오늘 남은 횟수 2 / 3')
    await userEvent.type(screen.getByLabelText('A 선택지'), '산')
    await userEvent.tab()
    expect(screen.getByLabelText('A 선택지')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('2~30자로 써 주세요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '토론 시작' }))
    expect(posts(fetchFn)).toHaveLength(0)
  })

  it('로그인 전이면 시작할 때 로그인 모달을 열고, 입력은 남긴다', async () => {
    const { fetchFn } = setup()
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '로그인하고 토론 시작' }))
    expect(await screen.findByRole('dialog', { name: '로그인하고 토론 만들기' })).toBeInTheDocument()
    expect(posts(fetchFn)).toHaveLength(0)
    expect(JSON.parse(sessionStorage.getItem('agora.createDraft') ?? '{}')).toEqual({ a: '등산', b: '바다' })

    await userEvent.click(await screen.findByRole('button', { name: '개발용 로그인(로컬 전용)' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: '토론 시작' })).toBeInTheDocument()
    expect(screen.getByLabelText('A 선택지')).toHaveValue('등산')
  })

  it('저장해 둔 입력을 다시 불러온다', async () => {
    sessionStorage.setItem('agora.createDraft', JSON.stringify({ a: '탕수육 부먹', b: '찍먹' }))
    setup()
    expect(await screen.findByLabelText('A 선택지')).toHaveValue('탕수육 부먹')
  })

  it('만들면 방금 만든 토론으로 기억하고 예측 화면으로 간다', async () => {
    sessionStorage.setItem('agora.createDraft', JSON.stringify({ a: '등산', b: '바다' }))
    const { fetchFn, router } = setup({ loggedIn: true })
    await screen.findByText('오늘 남은 횟수 2 / 3')
    await userEvent.click(screen.getByRole('button', { name: '토론 시작' }))
    expect(await screen.findByText('예측 화면')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/debates/new1')
    expect(JSON.parse(String(posts(fetchFn)[0][1]?.body))).toEqual({ topic_a: '등산', topic_b: '바다' })
    expect(JSON.parse(localStorage.getItem('agora.recentDebate') ?? '{}')).toMatchObject({ id: 'new1', topic_a: '등산' })
    expect(sessionStorage.getItem('agora.createDraft')).toBeNull()
  })

  it('비슷한 토론이 있으면 알려 주고 그 토론으로 가는 링크를 준다', async () => {
    setup({
      loggedIn: true,
      similar: { body: { debate: { id: 'old7', topic_a: '바다', topic_b: '등산', status: 'done', is_today: false, created_at: '2026-11-20T00:00:00Z', empathy_count: 0, prediction_count: 0 } } },
    })
    await fill('등산', '바다')
    expect(await screen.findByText('비슷한 토론이 이미 있어요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '그 토론 보러 가기' })).toHaveAttribute('href', '/debates/old7')
  })

  it('주제 확인에서 거절되면 이유와 안전한 추천을 보이고, 추천을 누르면 채워진다', async () => {
    setup({
      loggedIn: true,
      create: () => ({
        status: 422,
        body: { detail: { code: 'topic_rejected', message: '실존 인물을 비교하는 주제예요.', suggestions: [{ a: '등산', b: '바다' }] } },
      }),
    })
    await fill('누구', '누구2')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('heading', { name: '이 주제로는 토론하기 어려워요' })).toBeInTheDocument()
    expect(screen.getByText(/실존 인물을 비교하는 주제예요\. 횟수는 줄지 않았어요\./)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '등산 vs 바다' }))
    expect(screen.getByLabelText('A 선택지')).toHaveValue('등산')
  })

  it('내 하루 한도를 다 쓰면 다시 만들 수 있는 시각을 알려 준다', async () => {
    setup({
      loggedIn: true,
      create: () => ({ status: 429, body: { detail: { code: 'user_limit', message: '한도', reset_at: '2026-11-22T15:00:00' } } }),
    })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('heading', { name: '오늘 만들 수 있는 토론을 다 썼어요' })).toBeInTheDocument()
    expect(screen.getByText(/11월 23일 오전 12시부터 다시 만들 수 있어요/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '오늘의 토론 보기' }))
    expect(await screen.findByText('홈 화면')).toBeInTheDocument()
  })

  it('로그인했는데 남은 횟수가 0이면 입력 전에 한도 안내를 보인다', async () => {
    mockQuotaRemaining = 0
    setup({ loggedIn: true })
    expect(await screen.findByRole('heading', { name: '오늘 만들 수 있는 토론을 다 썼어요' })).toBeInTheDocument()
    expect(screen.queryByLabelText('A 선택지')).not.toBeInTheDocument()
  })

  it('전체 마감이면 마감 안내를 보인다', async () => {
    setup({ loggedIn: true, create: () => ({ status: 503, body: { detail: { code: 'global_closed', message: '마감' } } }) })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('heading', { name: '오늘은 토론 생성이 마감됐어요' })).toBeInTheDocument()
  })

  it('주제 확인이 실패하면 다시 시도할 수 있다', async () => {
    let calls = 0
    const { router } = setup({
      loggedIn: true,
      create: () => (++calls === 1 ? { status: 502, body: { detail: { code: 'check_failed', message: '실패' } } } : undefined),
    })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('heading', { name: '주제를 확인하지 못했어요' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('예측 화면')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/debates/new1')
  })

  it('서버가 입력 규칙으로 거절하면(topic_invalid) 입력 화면에 이유를 보인다', async () => {
    setup({ loggedIn: true, create: () => ({ status: 422, body: { detail: { code: 'topic_invalid', message: '선택지는 2~30자로 써 주세요.' } } }) })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('선택지는 2~30자로 써 주세요.')
    expect(screen.getByLabelText('A 선택지')).toHaveValue('등산')
  })

  it('인터넷이 끊겨 요청이 실패하면 확인 실패 안내(차감 없음)', async () => {
    setup({
      loggedIn: true,
      create: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('heading', { name: '주제를 확인하지 못했어요' })).toBeInTheDocument()
  })

  it('만드는 중 세션이 끝났으면(401) 로그인 모달을 연다', async () => {
    setup({ loggedIn: true, create: () => ({ status: 401, body: { detail: { code: 'login_required', message: '로그인' } } }) })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('dialog', { name: '로그인하고 토론 만들기' })).toBeInTheDocument()
  })

  it('AI 주제 확인을 하루에 너무 많이 하면 다시 되는 시각을 알려 준다', async () => {
    setup({ loggedIn: true, create: () => ({ status: 429, body: { detail: { code: 'check_limit', message: '많이', reset_at: '2026-11-22T15:00:00' } } }) })
    await fill('등산', '바다')
    await userEvent.click(await screen.findByRole('button', { name: '토론 시작' }))
    expect(await screen.findByRole('heading', { name: '오늘은 주제 확인을 많이 했어요' })).toBeInTheDocument()
    expect(screen.getByText(/11월 23일 오전 12시부터/)).toBeInTheDocument()
  })

  it('남은 횟수를 못 불러오면 그렇게 알린다', async () => {
    setup({ loggedIn: true, quota: { status: 500, body: { detail: { code: 'internal', message: 'x' } } } })
    expect(await screen.findByText('남은 횟수를 불러오지 못했어요')).toBeInTheDocument()
  })

  it('소셜 로그인이 실패해 돌아오면(?login=failed) 알리고 주소에서 지운다', async () => {
    const { router } = setup({ path: '/login-check?login=failed' })
    expect(await screen.findByText('로그인하지 못했어요. 다시 시도해 주세요.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })
})
