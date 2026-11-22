import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChatCircle } from '@phosphor-icons/react'
import { api, post } from '../../api/client'
import { Button } from '../../components/Button'
import { Popup } from '../../components/Popup'
import { useToast } from '../../components/toastContext'
import { meKey, type Me, type Providers } from './authContext'
import styles from './LoginModal.module.css'

type Props = { open: boolean; next: string; onClose: () => void }

/** COM_01_001 로그인 모달 — 구글·카카오(키가 없는 로컬에서는 개발용 로그인). 닫아도 쓰던 입력은 그대로(만들기 화면이 저장). */
export function LoginModal({ open, next, onClose }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: () => api<Providers>('/api/auth/providers'), enabled: open, staleTime: Infinity })
  const go = (provider: 'google' | 'kakao') => {
    window.location.assign(`/api/auth/${provider}/login?next=${encodeURIComponent(next)}`)
  }
  const devLogin = async () => {
    try {
      const me = await post<Me>('/api/auth/dev-login')
      qc.setQueryData(meKey, me)
      onClose()
    } catch {
      toast.show('로그인하지 못했어요. 다시 시도해 주세요.')
    }
  }
  const p = providers.data
  const none = p && !p.google && !p.kakao && !p.dev

  return (
    <Popup open={open} title="로그인하고 토론 만들기" onClose={onClose}>
      <p className={`ts-body-14-r ${styles.sub}`}>쓰던 주제는 그대로 남아 있어요. 로그인하면 바로 이어서 시작해요.</p>
      <div className={styles.providers}>
        {p?.kakao && (
          <button type="button" className={styles.kakao} onClick={() => go('kakao')}>
            <ChatCircle size={20} weight="fill" aria-hidden="true" />
            카카오로 계속하기
          </button>
        )}
        {p?.google && (
          <button type="button" className={styles.google} onClick={() => go('google')}>
            Google로 계속하기
          </button>
        )}
        {p?.dev && (
          <Button variant="secondary" size="l" fullWidth onClick={devLogin}>
            개발용 로그인(로컬 전용)
          </Button>
        )}
        {none && <p className={`ts-body-14-r ${styles.sub}`}>지금은 로그인을 준비 중이에요.</p>}
        {providers.isError && <p className={`ts-body-14-r ${styles.sub}`}>로그인 방법을 불러오지 못했어요.</p>}
      </div>
      <p className={`ts-caption-12-r ${styles.weak}`}>
        계속하면 <Link to="/terms" onClick={onClose}>이용약관</Link>과 <Link to="/privacy" onClick={onClose}>개인정보처리방침</Link>에 동의하게 돼요.
      </p>
    </Popup>
  )
}
