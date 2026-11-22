import { createContext, useContext } from 'react'

export type ToastApi = { show: (message: string) => void }

export const ToastContext = createContext<ToastApi>({ show: () => {} })

export const useToast = () => useContext(ToastContext)
