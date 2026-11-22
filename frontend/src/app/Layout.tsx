import { Outlet, useMatches } from 'react-router-dom'
import { Gnb } from './Gnb'
import { Footer } from './Footer'

export type RouteHandle = { hideFooter?: boolean }

/** 공통 레이아웃: GNB + 본문 + 푸터(무대는 푸터 없는 몰입형, §7) */
export function Layout() {
  const matches = useMatches()
  const hideFooter = matches.some((m) => (m.handle as RouteHandle | undefined)?.hideFooter)

  return (
    <>
      <Gnb nickname={null} onLogin={() => {}} onLogout={() => {}} />
      <main id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </>
  )
}
