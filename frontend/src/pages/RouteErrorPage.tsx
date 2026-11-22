import { StateBlock } from '../components/StateBlock'

/** 화면을 그리다 예상 못 한 오류가 났을 때(라우터 errorElement). */
export function RouteErrorPage() {
  return (
    <StateBlock
      title="화면을 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요."
      primary={{ label: '다시 시도', onClick: () => window.location.reload() }}
      secondary={{ label: '홈으로', onClick: () => window.location.assign('/') }}
    />
  )
}
