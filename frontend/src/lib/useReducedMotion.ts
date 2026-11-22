import { useMediaQuery } from './useMediaQuery'

/** 사용자가 "동작 줄이기"를 켰는지(§5 모션 표: 타자 효과는 즉시 표시, 자막은 opacity만). */
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
