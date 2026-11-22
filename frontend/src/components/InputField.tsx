import { useId, type InputHTMLAttributes } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import styles from './InputField.module.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string
  helper?: string
  error?: string | null
  maxLength: number
  value: string
}

/** MyDesign 09 Input Filled XL · 라벨 위 · Round(알약). 오류는 테두리 + 아이콘 + 글자(색만으로 알리지 않음). */
export function InputField({ label, helper, error, maxLength, value, className, ...rest }: Props) {
  const id = useId()
  const helpId = `${id}-help`
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.box} ${error ? styles.error : ''}`}>
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={helpId}
          className={styles.input}
          {...rest}
        />
        <span className={styles.count} aria-hidden="true">
          {value.length}/{maxLength}
        </span>
      </div>
      <p id={helpId} className={`${styles.helper} ${error ? styles.errorText : ''}`}>
        {error && <WarningCircle size={14} weight="fill" aria-hidden="true" />}
        {error ?? helper}
      </p>
    </div>
  )
}
