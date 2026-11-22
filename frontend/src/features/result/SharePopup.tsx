import { ChatCircle, Copy, Question } from '@phosphor-icons/react'
import type { DebateDetail } from '../../api/types'
import { Button } from '../../components/Button'
import { Logo } from '../../components/Logo'
import { Popup } from '../../components/Popup'
import { useToast } from '../../components/toastContext'
import { copyText } from '../../lib/clipboard'
import { ogImageUrlOf, SHARE_DESCRIPTION, shareUrlOf } from '../../lib/share'
import { kakaoAvailable, shareToKakao } from '../../lib/kakao'
import { titleOf } from '../debate/cast'
import styles from './SharePopup.module.css'

type Props = { open: boolean; debate: DebateDetail; onClose: () => void }

/** DEB_01_004 공유 — 미리보기 카드 · 카카오톡 · 링크 복사. 받는 사람은 승부 예측부터(승자 비노출). */
export function SharePopup({ open, debate, onClose }: Props) {
  const toast = useToast()
  const url = shareUrlOf(debate.id)

  const copy = async () => {
    toast.show((await copyText(url)) ? '링크를 복사했어요' : '복사하지 못했어요. 주소창의 링크를 써 주세요.')
  }

  const kakao = async () => {
    const sent = await shareToKakao({
      title: titleOf(debate),
      description: SHARE_DESCRIPTION,
      imageUrl: ogImageUrlOf(debate.id),
      url,
    })
    if (!sent) {
      // 카카오 키가 없거나 SDK를 못 불렀으면 링크를 복사해 메신저에 붙여 넣게 한다.
      const copied = await copyText(url)
      toast.show(copied ? '카카오톡에 붙여 넣을 링크를 복사했어요' : '복사하지 못했어요. 주소창의 링크를 써 주세요.')
    }
  }

  return (
    <Popup open={open} title="결과 공유하기" onClose={onClose}>
      <div className={styles.preview} aria-label="링크 미리보기">
        <Logo />
        <p className="ts-headline-24">{titleOf(debate)}</p>
        <p className={`ts-body-14-r ${styles.sub}`}>{SHARE_DESCRIPTION}</p>
      </div>
      <p className={`ts-caption-12-r ${styles.note}`}>
        <Question size={16} aria-hidden="true" />
        받는 사람은 승부 예측부터 봐요. 결과는 미리 보이지 않아요.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.kakao} onClick={kakao}>
          <ChatCircle size={20} aria-hidden="true" />
          {kakaoAvailable() ? '카카오톡으로 보내기' : '카카오톡용 링크 복사'}
        </button>
        <Button variant="secondary" className={styles.copy} icon={<Copy size={20} />} onClick={copy}>
          링크 복사
        </Button>
      </div>
    </Popup>
  )
}
