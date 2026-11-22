import styles from './TabLine.module.css'

type Tab<K extends string> = { key: K; label: string }

type Props<K extends string> = {
  tabs: Tab<K>[]
  value: K
  onChange: (key: K) => void
  label: string
}

/** MyDesign Tab Line — Color Brand, Indicator Text(선택 표시는 primary 허용) */
export function TabLine<K extends string>({ tabs, value, onChange, label }: Props<K>) {
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={t.key === value}
          className={t.key === value ? styles.selected : styles.tab}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
