import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '../test/render'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage (COM_01_003)', () => {
  it('없는 주소면 안내와 홈 버튼', async () => {
    const { router } = renderRoute(
      [{ path: '/', element: <div>home</div> }, { path: '*', element: <NotFoundPage /> }],
      '/nope',
    )
    expect(screen.getByRole('heading', { name: '없는 페이지예요' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '홈으로' }))
    expect(router.state.location.pathname).toBe('/')
  })
})
