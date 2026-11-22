import { useEffect, useState } from 'react'

export const MS_PER_CHAR = 20 // §7 타자 효과 속도: 글자당 20ms(300자 ≈ 6초)

/** 글자를 하나씩 보여 준다. key가 바뀌면 처음부터. instant면 바로 전부(동작 줄이기·즉시 완성). */
export function useTypewriter(text: string, key: string | number, instant: boolean) {
  const [state, setState] = useState({ key, count: 0 })
  // 다른 발언으로 바뀌면 렌더 중에 초기화한다(effect에서 리셋하면 한 프레임 옛 글자가 보인다).
  if (state.key !== key) setState({ key, count: 0 })
  // 위 setState는 다음 렌더부터 반영되므로, 이번 렌더에서는 key가 다르면 0으로 본다.
  const count = instant ? text.length : state.key === key ? state.count : 0

  useEffect(() => {
    if (instant || count >= text.length) return
    const timer = window.setTimeout(() => setState((s) => ({ ...s, count: s.count + 1 })), MS_PER_CHAR)
    return () => window.clearTimeout(timer)
  }, [count, instant, text.length])

  return { shown: text.slice(0, count), done: count >= text.length }
}
