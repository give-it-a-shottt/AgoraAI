import { useSyncExternalStore } from 'react'

export const MOBILE_QUERY = '(max-width: 639px)'

/** CSS 미디어 쿼리 결과를 구독한다(MO/PC 컴포넌트 분기용, §4-1: 640 미만 MO). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
