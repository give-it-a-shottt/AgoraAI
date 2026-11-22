/** 로그인 없이 같은 브라우저를 알아보는 무작위 번호(예측·공감·신고 1회 제한용). */
const KEY = 'agora.browserId'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // 오래된 브라우저용 대체(UUID v4 모양)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

let memoryId: string | null = null

export function getBrowserId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = makeId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // 사생활 보호 모드 등으로 저장이 막히면 탭이 살아 있는 동안만 쓴다.
    memoryId ??= makeId()
    return memoryId
  }
}
