import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

const GITHUB_URL = import.meta.env.VITE_GITHUB_URL as string | undefined

/** MyDesign 21 Footer PC Minimal · MO Simple (Light) — 사업자 정보 없음(비상업) */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <nav className={styles.links} aria-label="사이트 정보">
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          {GITHUB_URL ? (
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          ) : (
            <span>GitHub</span>
          )}
        </nav>
        <p className={styles.copy}>© 2026 Agora · 비상업 포트폴리오 프로젝트</p>
      </div>
    </footer>
  )
}
