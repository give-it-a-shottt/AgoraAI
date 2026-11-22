import styles from './Badge.module.css'

type Props = { status: 'live' | 'done' }

/** MyDesign 12 Badge S Soft — 진행 중(색 + 점 + 글자) / 완료. 승자는 표시하지 않는다. */
export function Badge({ status }: Props) {
  return status === 'live' ? (
    <span className={`${styles.badge} ${styles.live}`}>
      <span className={styles.dot} aria-hidden="true" />
      진행 중
    </span>
  ) : (
    <span className={`${styles.badge} ${styles.done}`}>완료</span>
  )
}
