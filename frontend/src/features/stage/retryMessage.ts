import { ApiError } from '../../api/client'

/** 멈춘 토론 [다시 시도] 실패를 사용자 문구로. null이면 토스트 대신 목록을 다시 읽는다(그사이 다시 생성 중). */
export function retryErrorMessage(e: unknown): string | null {
  if (e instanceof ApiError) {
    if (e.code === 'not_paused') return null
    if (e.code === 'retry_too_soon') return `${Number(e.extra.retry_after) || 60}초 뒤에 다시 시도해 주세요.`
    if (e.code === 'retry_limit') return '이 토론은 더 이어서 만들 수 없어요. 다른 토론을 봐 주세요.'
  }
  return '다시 시도하지 못했어요. 잠시 후 눌러 주세요.'
}
