import styles from './Skeleton.module.css'

type Props = { width?: number | string; height: number; radius?: number }

/** 목록 Skeleton(25장) — 스크린리더에는 숨긴다(상위에 aria-busy) */
export function Skeleton({ width = '100%', height, radius = 8 }: Props) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}
