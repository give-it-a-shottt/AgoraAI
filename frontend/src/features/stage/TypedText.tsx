import { useEffect } from 'react'
import { useTypewriter } from './useTypewriter'

type Props = {
  text: string
  utteranceId: number
  /** 동작 줄이기거나 [다음 발언]으로 즉시 완성했을 때 */
  instant: boolean
  onDone: (utteranceId: number) => void
  className?: string
}

/** 타자 효과 글자 층. 20ms마다 다시 그리는 범위를 이 작은 컴포넌트로 가둔다(무대 전체가 다시 그려지지 않게).
 * 발언 전체 글자는 스크린리더용으로 처음부터 DOM에 두고, 글자가 나오는 층은 aria-hidden(§8). */
export function TypedText({ text, utteranceId, instant, onDone, className }: Props) {
  const typing = useTypewriter(text, utteranceId, instant)
  useEffect(() => {
    if (typing.done) onDone(utteranceId)
  }, [typing.done, utteranceId, onDone])
  return (
    <p className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{typing.shown}</span>
    </p>
  )
}
