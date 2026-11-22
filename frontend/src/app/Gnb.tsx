import { Link, NavLink, useLocation } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import styles from './Gnb.module.css'

type Props = {
  nickname: string | null
  onLogin: () => void
  onLogout: () => void
}

/** MyDesign 20 GNB PC Type A 1단 (MO는 Main MO Default: 로고 왼쪽 + [만들기]·로그인) */
export function Gnb({ nickname, onLogin, onLogout }: Props) {
  const { search } = useLocation()
  const isLatest = new URLSearchParams(search).get('sort') === 'latest'

  return (
    <header className={styles.gnb}>
      <div className={styles.container}>
        <div className={styles.left}>
          <Link to="/" aria-label="Agora 홈">
            <Logo />
          </Link>
          <nav className={styles.menu} aria-label="주 메뉴">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive && !isLatest ? styles.active : styles.item)}
            >
              오늘의 토론
            </NavLink>
            <NavLink
              to="/?sort=latest#browse"
              className={() => (isLatest ? styles.active : styles.item)}
            >
              지난 토론
            </NavLink>
          </nav>
        </div>
        <div className={styles.right}>
          {nickname ? (
            <Button variant="text" size="m" tone="sub" onClick={onLogout}>
              로그아웃
            </Button>
          ) : (
            <Button variant="text" size="m" tone="sub" onClick={onLogin} className={styles.login}>
              로그인
            </Button>
          )}
          <Link to="/create" className={styles.create}>
            <Plus size={20} aria-hidden="true" />
            <span className="pc-only">토론 만들기</span>
            <span className="mo-only">만들기</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
