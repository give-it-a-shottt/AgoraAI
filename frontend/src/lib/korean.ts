/** 받침에 맞춰 조사를 고른다: withRo('짬뽕') → '짬뽕으로', withRo('바다') → '바다로', withRo('물') → '물로' */
export function withRo(word: string): string {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return `${word}(으)로` // 한글이 아니면 둘 다 표시
  const jong = code % 28
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로` // 받침 없음·ㄹ받침 → 로
}
