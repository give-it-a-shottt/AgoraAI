import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { LegalPage } from '../pages/LegalPage'
import { RouteErrorPage } from '../pages/RouteErrorPage'
import { HomePage } from '../pages/HomePage'
import { PredictPage } from '../pages/PredictPage'
import { StagePage } from '../pages/StagePage'
import { ResultPage } from '../pages/ResultPage'
import { CreatePage } from '../pages/CreatePage'
import type { RouteHandle } from './Layout'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/create', element: <CreatePage />, handle: { moSub: true } satisfies RouteHandle },
      { path: '/debates/:id', element: <PredictPage />, handle: { moSub: true } satisfies RouteHandle },
      { path: '/debates/:id/result', element: <ResultPage />, handle: { moSub: true } satisfies RouteHandle },
      { path: '/debates/:id/stage', element: <StagePage />, handle: { hideFooter: true, moSub: true } satisfies RouteHandle },
      { path: '/terms', element: <LegalPage kind="terms" /> },
      { path: '/privacy', element: <LegalPage kind="privacy" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
