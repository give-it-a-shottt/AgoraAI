import { Outlet, useMatches } from 'react-router-dom'
import { Gnb } from './Gnb'
import { Footer } from './Footer'
import styles from './Layout.module.css'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../features/auth/auth'
import { useAuth } from '../features/auth/authContext'

export type RouteHandle = { hideFooter?: boolean }

/** 공통 레이아웃: GNB + 본문 + 푸터(무대는 푸터 없는 몰입형, §7) */
export function Layout() {
  const matches = useMatches()
  const hideFooter = matches.some((m) => (m.handle as RouteHandle | undefined)?.hideFooter)

  return (
    <ToastProvider>
      <AuthProvider>
        <AuthedGnb />
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
        {!hideFooter && <Footer />}
      </AuthProvider>
    </ToastProvider>
  )
}

function AuthedGnb() {
  const auth = useAuth()
  return <Gnb nickname={auth.user?.nickname ?? null} onLogin={() => auth.openLogin()} onLogout={auth.logout} />
}
