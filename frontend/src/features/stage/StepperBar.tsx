import styles from './StepperBar.module.css'

export const ROUND_NAMES = ['주장', '반박', '마무리'] as const

/** MyDesign 17 Stepper Bar · Steps 3 — 현재 단계까지 막대가 찬다. 목록(ol) + aria-current(§8). */
export function StepperBar({ round }: { round: number }) {
  return (
    <ol className={styles.stepper} aria-label="토론 진행 단계">
      {ROUND_NAMES.map((name, i) => {
        const step = i + 1
        const state = step < round ? 'past' : step === round ? 'current' : 'future'
        return (
          <li key={name} className={`${styles.step} ${styles[state]}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.bar} aria-hidden="true" />
            <span className={styles.label}>
              {step}R {name}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
