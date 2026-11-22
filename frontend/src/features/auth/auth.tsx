import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import { useToast } from '../../components/toastContext'
import { AuthContext, meKey, quotaKey, type Me } from './authContext'
import { LoginModal } from './LoginModal'

/** 로그인 상태와 로그인 모달(COM_01_001)을 앱 전체에 제공한다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: meKey, queryFn: () => api<Me>('/api/auth/me'), staleTime: 60_000 })
  const [modal, setModal] = useState<{ next: string } | null>(null)
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const loginFailed = params.get('login') === 'failed'

  // OAuth 콜백 실패는 서버가 "/?login=failed"로 보낸다 → 한 번 알리고 주소에서 지운다
  useEffect(() => {
    if (!loginFailed) return
    toast.show('로그인하지 못했어요. 다시 시도해 주세요.')
    setParams(
      (p) => {
        p.delete('login')
        return p
      },
      { replace: true },
    )
  }, [loginFailed, setParams, toast])
  const logout = useMutation({
    mutationFn: () => post<{ ok: boolean }>('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData<Me>(meKey, { user: null })
      qc.removeQueries({ queryKey: quotaKey }) // 다음 사람이 남의 남은 횟수를 보지 않게
    },
  })

  return (
    <AuthContext.Provider
      value={{
        user: me.data?.user ?? null,
        loading: me.isPending,
        openLogin: (next) => setModal({ next: next ?? window.location.pathname + window.location.search }),
        logout: () => logout.mutate(),
      }}
    >
      {children}
      <LoginModal open={modal !== null} next={modal?.next ?? '/'} onClose={() => setModal(null)} />
    </AuthContext.Provider>
  )
}
