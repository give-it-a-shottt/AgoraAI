import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { StateBlock } from './StateBlock'
import { NotFoundPage } from '../pages/NotFoundPage'

type Props = { error: unknown; onRetry: () => void }

/** 화면 데이터를 못 불러왔을 때 공통 처리:
 * 없는 토론(404) → COM_01_003, 인터넷 끊김 → COM_01_002, 그 밖 → 다시 시도. */
export function LoadError({ error, onRetry }: Props) {
  const navigate = useNavigate()
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (error instanceof ApiError && error.isNetwork) {
    return (
      <StateBlock
        character="cat"
        title="인터넷 연결이 끊겼어요"
        description="연결되면 보던 라운드부터 이어서 보여 드려요."
        primary={{ label: '다시 시도', onClick: onRetry }}
      />
    )
  }
  return (
    <StateBlock
      title="잠시 문제가 생겼어요"
      description={error instanceof ApiError ? error.message : '잠시 후 다시 시도해 주세요.'}
      primary={{ label: '다시 시도', onClick: onRetry }}
      secondary={{ label: '홈으로', onClick: () => navigate('/') }}
    />
  )
}
