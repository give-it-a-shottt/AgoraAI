/** 받침에 맞춰 조사를 고른다: withRo('짬뽕') → '짬뽕으로', withRo('바다') → '바다로', withRo('물') → '물로' */
export function withRo(word: string): string {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return `${word}(으)로` // 한글이 아니면 둘 다 표시
  const jong = code % 28
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로` // 받침 없음·ㄹ받침 → 로
}

function hasBatchim(word: string): boolean | null {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return null
  return code % 28 !== 0
}

/** 주격 조사: withIGa('냥냥이') → '냥냥이가', withIGa('부엉') → '부엉이' 처럼 받침이면 '이' */
export function withIGa(word: string): string {
  const b = hasBatchim(word)
  return b === null ? `${word}이(가)` : `${word}${b ? '이' : '가'}`
}
