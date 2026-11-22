import { Outlet, useMatches } from 'react-router-dom'
import { Gnb } from './Gnb'
import { Footer } from './Footer'
import styles from './Layout.module.css'

export type RouteHandle = { hideFooter?: boolean }

/** 공통 레이아웃: GNB + 본문 + 푸터(무대는 푸터 없는 몰입형, §7) */
export function Layout() {
  const matches = useMatches()
  const hideFooter = matches.some((m) => (m.handle as RouteHandle | undefined)?.hideFooter)

  return (
    <>
      {/* TODO(F-007): 로그인 상태·로그인 모달 연결 전까지 임시 값 */}
      <Gnb nickname={null} onLogin={() => {}} onLogout={() => {}} />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </>
  )
}
