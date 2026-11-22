import { useNavigate } from 'react-router-dom'
import { StateBlock } from '../components/StateBlock'

/** COM_01_003 없는 페이지 */
export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <StateBlock
      title="없는 페이지예요"
      description="주소가 바뀌었거나 지워진 토론이에요."
      primary={{ label: '홈으로', onClick: () => navigate('/') }}
    />
  )
}
