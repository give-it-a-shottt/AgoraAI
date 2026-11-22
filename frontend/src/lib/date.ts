/** 서버 시간은 타임존 없는 UTC 문자열이라 'Z'를 붙여 읽는다. 날짜 비교는 한국 시간 기준. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function parseServerTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

function kstDayNumber(d: Date): number {
  return Math.floor((d.getTime() + KST_OFFSET_MS) / DAY_MS)
}

/** "오늘" · "어제" · "N일 전" */
export function relativeDay(value: string, now: Date = new Date()): string {
  const diff = kstDayNumber(now) - kstDayNumber(parseServerTime(value))
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  return `${diff}일 전`
}

/** "2026-11-22" → "11월 22일" */
export function monthDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${m}월 ${d}일`
}
