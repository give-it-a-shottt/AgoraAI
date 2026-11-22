import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components/toastContext'
import { useEmpathy } from './queries'

/** 기다리기 시작한 뒤 흐른 초. waiting이 꺼지면 0으로. reset으로 다시 처음부터 잴 수 있다. */
export function useWaitElapsed(waiting: boolean) {
  const [start, setStart] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!waiting) {
      setStart(null)
      return
    }
    setStart((s) => s ?? Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [waiting])

  const reset = useCallback(() => {
    const t = Date.now()
    setStart(t)
    setNow(t)
  }, [])

  return { elapsed: start === null ? 0 : Math.max(0, (now - start) / 1000), reset }
}

/** 조건이 맞는 동안 delay 뒤 advance를 한 번 부른다(다시보기 자동 진행). step이 바뀌면 다시 잰다. */
export function useAutoAdvance(enabled: boolean, delayMs: number, advance: () => void, step: number) {
  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(advance, delayMs)
    return () => window.clearTimeout(timer)
  }, [enabled, delayMs, advance, step])
}

/** 발언마다 공감 한 번. 누르면 바로 눌림 표시, 실패하면 되돌리고 알린다.
 * 눌림 표시는 이 화면에서만 기억한다(서버는 중복을 막지만 "이미 눌렀는지"는 목록에 없음 — 알려진 한계). */
export function useEmpathyOnce(debateId: string) {
  const toast = useToast()
  const empathy = useEmpathy(debateId)
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set())

  const press = (utteranceId: number) => {
    if (pressed.has(utteranceId)) return
    setPressed((s) => new Set(s).add(utteranceId))
    empathy.mutate(utteranceId, {
      onError: () => {
        setPressed((s) => {
          const next = new Set(s)
          next.delete(utteranceId)
          return next
        })
        toast.show('공감을 남기지 못했어요.')
      },
    })
  }
  return { pressed, press }
}
