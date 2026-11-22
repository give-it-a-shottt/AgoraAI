import { useNavigate } from 'react-router-dom'
import { StateBlock } from './StateBlock'

/** COM_01_003 없는 페이지 상태 블록(라우트 404와 "없는 토론" 응답이 같이 쓴다) */
export function NotFoundState() {
  const navigate = useNavigate()
  return (
    <StateBlock
      title="없는 페이지예요"
      description="주소가 바뀌었거나 지워진 토론이에요."
      primary={{ label: '홈으로', onClick: () => navigate('/') }}
    />
  )
}
