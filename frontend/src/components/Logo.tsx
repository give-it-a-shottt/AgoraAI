import styles from './Logo.module.css'

/** Agora 로고 — "AI" 박스 라운드 6px(로고 전용, §7) */
export function Logo() {
  return (
    <span className={styles.logo}>
      <span className="ts-logo-22">Agora</span>
      <span className={styles.ai}>AI</span>
    </span>
  )
}
