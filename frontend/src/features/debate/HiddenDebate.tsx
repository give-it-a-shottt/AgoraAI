import { useNavigate } from 'react-router-dom'
import { StateBlock } from '../../components/StateBlock'

/** DEB_01_008 신고가 많아 가려진 토론 */
export function HiddenDebate() {
  const navigate = useNavigate()
  return (
    <StateBlock
      character="owl"
      title="신고가 많아 가려 둔 토론이에요"
      description="신고가 3건 쌓여 확인하는 동안 가려 두었어요. 문제가 없으면 다시 열려요."
      primary={{ label: '다른 토론 보기', onClick: () => navigate('/') }}
    />
  )
}
