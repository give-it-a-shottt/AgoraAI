import type { ButtonHTMLAttributes } from 'react'
import styles from './Chip.module.css'

/** 추천 칩 — Button Pill 용도(08장). 터치 영역 44 이상(§6 S4 칩 터치 36 지적 반영: 위아래 여백으로 확보) */
export function Chip({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${styles.chip} ${className ?? ''}`} {...rest} />
}
