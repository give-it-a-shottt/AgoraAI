import { Outlet, useMatches } from 'react-router-dom'
import { Gnb } from './Gnb'
import { Footer } from './Footer'
import styles from './Layout.module.css'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../features/auth/auth'
import { useAuth } from '../features/auth/authContext'

/** hideFooter: 늘 숨김(무대) · moSub: 640 미만에서 메인 GNB·푸터 대신 화면의 Sub MO 헤더를 쓴다(Figma MO) */
export type RouteHandle = { hideFooter?: boolean; moSub?: boolean }

/** 공통 레이아웃: GNB + 본문 + 푸터(무대는 푸터 없는 몰입형, §7) */
export function Layout() {
  const matches = useMatches()
  const handles = matches.map((m) => m.handle as RouteHandle | undefined)
  const hideFooter = handles.some((h) => h?.hideFooter)
  const moSub = handles.some((h) => h?.moSub)

  return (
    <ToastProvider>
      <AuthProvider>
        <div className={moSub ? styles.pcOnly : undefined}>
          <AuthedGnb />
        </div>
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
        {!hideFooter && (
          <div className={moSub ? styles.pcOnly : styles.footerWrap}>
            <Footer />
          </div>
        )}
      </AuthProvider>
    </ToastProvider>
  )
}

function AuthedGnb() {
  const auth = useAuth()
  return <Gnb nickname={auth.user?.nickname ?? null} onLogin={() => auth.openLogin()} onLogout={auth.logout} />
}
