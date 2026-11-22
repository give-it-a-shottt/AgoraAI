import styles from './CaptionBox.module.css'

/** 자막 박스(로컬 컴포넌트, §7) — 무대에만, 발언당 하나, 발언이 다 나온 뒤 등장. 숨김 라벨 "핵심 한 줄:"(§8). */
export function CaptionBox({ caption }: { caption: string }) {
  return (
    <p className={styles.caption}>
      <span className="sr-only">핵심 한 줄: </span>
      {caption}
    </p>
  )
}
