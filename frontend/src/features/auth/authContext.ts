import { createContext, useContext } from 'react'

export type Me = { user: { id: number; nickname: string } | null }
export type Providers = { google: boolean; kakao: boolean; dev: boolean }

export const meKey = ['auth', 'me'] as const

export type AuthApi = {
  user: { id: number; nickname: string } | null
  loading: boolean
  /** 로그인 모달 열기. next: 로그인 뒤 돌아올 경로(기본: 지금 주소) */
  openLogin: (next?: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthApi>({ user: null, loading: false, openLogin: () => {}, logout: () => {} })

export const useAuth = () => useContext(AuthContext)
