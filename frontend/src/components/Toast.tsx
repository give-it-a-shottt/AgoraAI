import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import styles from './Toast.module.css'
import { ToastContext } from './toastContext'

const TOAST_MS = 3000 // MyDesign 13 Toast — 3초

/** 화면 아래 가운데 토스트 하나. 스크린리더에는 role=status로 읽힌다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    setMessage(next)
    timer.current = window.setTimeout(() => setMessage(null), TOAST_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {message && (
          <div className={styles.toast}>
            <CheckCircle size={20} weight="fill" aria-hidden="true" className={styles.icon} />
            <span>{message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
