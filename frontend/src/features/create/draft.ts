/** 만들기 입력 임시 저장(§0-4 COM_01_001 "취소해도 입력 유지" — 로그인하러 다녀와도 남게 탭 저장소에). */
const KEY = 'agora.createDraft'

export type Draft = { a: string; b: string }

export function loadDraft(): Draft {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Partial<Draft>
    return { a: typeof v.a === 'string' ? v.a : '', b: typeof v.b === 'string' ? v.b : '' }
  } catch {
    return { a: '', b: '' }
  }
}

export function saveDraft(d: Draft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* 저장이 막혀도 입력은 계속 */
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}
