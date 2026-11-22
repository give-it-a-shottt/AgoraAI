import type { Result, Side } from '../../api/types'

// 서버 상수와 같은 값(backend/app/services/results.py). 문구에 쓰는 숫자를 한곳에서 관리한다.
export const AUDIENCE_MIN = 5 // 관객 판정은 5명부터
export const REPORT_HIDE_COUNT = 3 // 서로 다른 3명이 신고하면 가림

export type JudgedResult = Result & { judge_status: 'done'; winner: Side }

/** 판정이 끝나 승자가 정해졌는지(타입도 좁혀 준다) */
export const isJudged = (r: Result): r is JudgedResult => r.judge_status === 'done' && r.winner !== null
