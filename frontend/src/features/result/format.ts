/** 0.78 → "78%", 없으면 "–" */
export const percent = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`)
