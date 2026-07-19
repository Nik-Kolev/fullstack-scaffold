import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { clearAccessToken, setAccessToken } from '@/lib/axios'
import * as authService from '@/services/auth'
import * as userService from '@/services/user'
import type { AuthResponse, User } from '@/types'

type AuthContextType = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: { email: string; password: string }) => Promise<void>
  register: (data: { name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>
  forgotPassword: (data: { email: string }) => Promise<void>
  resetPassword: (data: { token: string; newPassword: string }) => Promise<void>
  googleLogin: () => void
  googleExchange: (code: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const USER_KEY = 'user'

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function storeUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearStoredUser() {
  localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [isLoading, setIsLoading] = useState(true)
  const initRun = useRef(false)

  useEffect(() => {
    if (initRun.current) return
    initRun.current = true
    const init = async () => {
      if (window.location.pathname === '/auth/callback') {
        setIsLoading(false)
        return
      }
      try {
        const { data: refreshData } = await authService.silentRefresh()
        setAccessToken(refreshData.accessToken)
        const { data: meData } = await userService.getMe()
        setUser(meData.user)
        storeUser(meData.user)
      } catch {
        clearAccessToken()
        setUser(null)
        clearStoredUser()
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const handleAuthResponse = useCallback(({ accessToken, user }: AuthResponse) => {
    setAccessToken(accessToken)
    setUser(user)
    storeUser(user)
  }, [])

  const login = async (data: { email: string; password: string }) => {
    const { data: authData } = await authService.login(data)
    handleAuthResponse(authData)
  }

  const register = async (data: { name: string; email: string; password: string }) => {
    const { data: authData } = await authService.register(data)
    handleAuthResponse(authData)
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      clearAccessToken()
      setUser(null)
      clearStoredUser()
    }
  }

  const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    const { data: res } = await authService.changePassword(data)
    handleAuthResponse(res)
  }

  const forgotPassword = async (data: { email: string }) => {
    await authService.forgotPassword(data)
  }

  const resetPassword = async (data: { token: string; newPassword: string }) => {
    const { data: authData } = await authService.resetPassword(data)
    handleAuthResponse(authData)
  }

  const googleExchange = useCallback(
    async (code: string) => {
      const { data } = await authService.exchangeGoogleCode(code)
      handleAuthResponse(data)
    },
    [handleAuthResponse],
  )

  const googleLogin = () => {
    const width = 500
    const height = 600
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2)

    const popup = window.open(
      `${import.meta.env.VITE_API_URL}/auth/google`,
      'google-login',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`,
    )

    if (!popup) {
      toast.error(t('errors.popupBlocked'))
      return
    }

    const pollId = setInterval(() => {
      if (popup.closed) cleanup()
    }, 500)

    const cleanup = () => {
      window.removeEventListener('message', handler)
      clearInterval(pollId)
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        handleAuthResponse(event.data.payload as AuthResponse)
        cleanup()
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        toast.error(t('errors.googleSignInFailed'))
        cleanup()
      }
    }

    window.addEventListener('message', handler)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        logout,
        changePassword,
        forgotPassword,
        resetPassword,
        googleLogin,
        googleExchange,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
