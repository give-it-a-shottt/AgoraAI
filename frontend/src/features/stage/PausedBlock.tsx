import { StateBlock } from '../../components/StateBlock'

export const PAUSED_TITLE = '토론이 잠깐 멈췄어요'

type Props = {
  doneRounds: number
  hasUtterances: boolean
  retrying: boolean
  onRetry: () => void
  onViewPartial?: () => void
}

/** DEB_01_007 토론이 잠깐 멈췄어요 — [다시 시도] · [N라운드까지 보기] */
export function PausedBlock({ doneRounds, hasUtterances, retrying, onRetry, onViewPartial }: Props) {
  return (
    <StateBlock
      layout="inline"
      character="penguin"
      title={PAUSED_TITLE}
      description={
        doneRounds > 0
          ? `${doneRounds}라운드까지는 완성됐어요. 다시 시도하면 멈춘 곳부터 이어서 만들어요.`
          : '다시 시도하면 멈춘 곳부터 이어서 만들어요.'
      }
      primary={{ label: retrying ? '요청하는 중…' : '다시 시도', onClick: onRetry }}
      secondary={
        hasUtterances && onViewPartial
          ? { label: doneRounds > 0 ? `${doneRounds}라운드까지 보기` : '지금까지 보기', onClick: onViewPartial, variant: 'text' }
          : undefined
      }
    />
  )
}
