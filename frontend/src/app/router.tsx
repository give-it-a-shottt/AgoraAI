import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { LegalPage } from '../pages/LegalPage'
import { RouteErrorPage } from '../pages/RouteErrorPage'
import { HomePage } from '../pages/HomePage'
import { PredictPage } from '../pages/PredictPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/debates/:id', element: <PredictPage /> },
      { path: '/terms', element: <LegalPage kind="terms" /> },
      { path: '/privacy', element: <LegalPage kind="privacy" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
