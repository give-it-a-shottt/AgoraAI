/** 공유 주소 규칙(서버 routers/share.py와 같음). 받은 사람은 /share/{id} → 승부 예측부터. */
export const shareUrlOf = (debateId: string) => `${window.location.origin}/share/${encodeURIComponent(debateId)}`

/** 미리보기 이미지(1200×630, 승자 없음) */
export const ogImageUrlOf = (debateId: string) => `${window.location.origin}/api/og/${encodeURIComponent(debateId)}.png`

/** 미리보기 안내 문구(서버 services/share.py SHARE_DESCRIPTION과 같음) */
export const SHARE_DESCRIPTION = '누가 이겼을까요? 먼저 예측하고 보세요'
