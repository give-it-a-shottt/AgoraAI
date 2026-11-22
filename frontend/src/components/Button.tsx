import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'text'
type Size = 'xl' | 'l' | 'm'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  /** Text 버튼 글자 톤 — 08 규칙: Text 버튼은 무채색 */
  tone?: 'main' | 'sub'
  icon?: ReactNode
  /** aria-disabled로 비활성(포커스는 유지) — §8 비활성 [다음 발언] */
  softDisabled?: boolean
  fullWidth?: boolean
}

/** MyDesign 08 Button (Round, radius/button 12). 한 영역에 Primary는 1개. */
export function Button({
  variant = 'primary',
  size = 'xl',
  tone = 'main',
  icon,
  softDisabled,
  fullWidth,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    styles.button,
    styles[variant],
    styles[size],
    variant === 'text' && tone === 'sub' ? styles.toneSub : '',
    fullWidth ? styles.full : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      className={cls}
      aria-disabled={softDisabled || undefined}
      onClick={softDisabled ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
