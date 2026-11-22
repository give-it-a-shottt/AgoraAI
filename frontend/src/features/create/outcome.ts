import { ApiError } from '../../api/client'
import type { TopicPair } from './suggestions'

/** 만들기 요청이 실패했을 때 화면이 갈 상태(CRT_01_003·004·006·007). */
export type Outcome =
  | { kind: 'rejected'; reason: string; suggestions: TopicPair[] }
  | { kind: 'user_limit'; resetAt: string }
  | { kind: 'check_limit'; resetAt: string }
  | { kind: 'global_closed' }
  | { kind: 'check_failed' }

export type FailureAction =
  | { type: 'outcome'; outcome: Outcome }
  | { type: 'login' } // 세션이 끝남 → 로그인 모달
  | { type: 'form'; message: string } // 서버 입력 검사(topic_invalid) — 입력 화면에 문구로

const isPair = (v: unknown): v is TopicPair =>
  typeof v === 'object' && v !== null && typeof (v as TopicPair).a === 'string' && typeof (v as TopicPair).b === 'string'

/** 서버 에러 코드(api-list POST /api/debates) → 화면 상태. 모르는 실패·네트워크 끊김은 "확인 실패"(차감 없음). */
export function toFailureAction(e: unknown): FailureAction {
  if (!(e instanceof ApiError)) return { type: 'outcome', outcome: { kind: 'check_failed' } }
  if (e.status === 401) return { type: 'login' }
  const resetAt = typeof e.extra.reset_at === 'string' ? e.extra.reset_at : ''
  switch (e.code) {
    case 'topic_rejected': {
      const suggestions = Array.isArray(e.extra.suggestions) ? e.extra.suggestions.filter(isPair) : []
      return { type: 'outcome', outcome: { kind: 'rejected', reason: e.message, suggestions } }
    }
    case 'user_limit':
      return { type: 'outcome', outcome: { kind: 'user_limit', resetAt } }
    case 'check_limit':
      return { type: 'outcome', outcome: { kind: 'check_limit', resetAt } }
    case 'global_closed':
      return { type: 'outcome', outcome: { kind: 'global_closed' } }
    case 'topic_invalid':
    case 'validation':
      return { type: 'form', message: e.code === 'topic_invalid' ? e.message : '입력한 내용을 다시 확인해 주세요.' }
    default:
      return { type: 'outcome', outcome: { kind: 'check_failed' } }
  }
}
