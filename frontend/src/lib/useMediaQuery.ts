import { useCallback, useSyncExternalStore } from 'react'

export const MOBILE_QUERY = '(max-width: 639px)'

/** CSS 미디어 쿼리 결과를 구독한다(MO/PC 컴포넌트 분기용, §4-1: 640 미만 MO). */
export function useMediaQuery(query: string): boolean {
  // query가 같으면 같은 구독 함수를 써서 렌더마다 다시 구독하지 않게 한다.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
