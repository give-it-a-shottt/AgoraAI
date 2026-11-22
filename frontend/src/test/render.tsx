import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'

/** 라우터 + QueryClient로 감싸 렌더한다(테스트마다 새 캐시). */
export function renderRoute(routes: RouteObject[], initialPath = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return { router, ...render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>) }
}

export function renderPage(element: ReactElement, path = '/', initialPath = path) {
  return renderRoute([{ path, element }, { path: '*', element: <div>other</div> }], initialPath)
}
