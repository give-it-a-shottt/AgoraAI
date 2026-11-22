import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { LegalPage } from '../pages/LegalPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/terms', element: <LegalPage kind="terms" /> },
      { path: '/privacy', element: <LegalPage kind="privacy" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
