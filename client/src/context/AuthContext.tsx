import { createContext, useContext, useEffect, useState } from 'react'

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
  resetPassword: (data: { token: string; password: string }) => Promise<void>
  googleLogin: () => void
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
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: refreshData } = await authService.silentRefresh()
        setAccessToken(refreshData.accessToken)
        const { data: userData } = await userService.getMe()
        setUser(userData)
        storeUser(userData)
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

  const handleAuthResponse = ({ accessToken, user }: AuthResponse) => {
    setAccessToken(accessToken)
    setUser(user)
    storeUser(user)
  }

  const login = async (data: { email: string; password: string }) => {
    const { data: authData } = await authService.login(data)
    handleAuthResponse(authData)
  }

  const register = async (data: { name: string; email: string; password: string }) => {
    const { data: authData } = await authService.register(data)
    handleAuthResponse(authData)
  }

  const logout = async () => {
    await authService.logout()
    clearAccessToken()
    setUser(null)
    clearStoredUser()
  }

  const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    await authService.changePassword(data)
  }

  const forgotPassword = async (data: { email: string }) => {
    await authService.forgotPassword(data)
  }

  const resetPassword = async (data: { token: string; password: string }) => {
    await authService.resetPassword(data)
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
        googleLogin: authService.googleLogin,
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
