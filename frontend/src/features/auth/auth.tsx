import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../../api/client'
import { AuthContext, meKey, type Me } from './authContext'
import { LoginModal } from './LoginModal'

/** 로그인 상태와 로그인 모달(COM_01_001)을 앱 전체에 제공한다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: meKey, queryFn: () => api<Me>('/api/auth/me'), staleTime: 60_000 })
  const [modal, setModal] = useState<{ next: string } | null>(null)
  const logout = useMutation({
    mutationFn: () => post<{ ok: boolean }>('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData<Me>(meKey, { user: null })
      qc.removeQueries({ queryKey: ['me'] }) // 다음 사람이 남의 남은 횟수를 보지 않게
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
