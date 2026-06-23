import axios from 'axios'

import { api } from '@/lib/axios'
import type { AuthResponse } from '@/types'

export const login = (data: { email: string; password: string }) =>
  api.post<AuthResponse>('/auth/login', data)

export const register = (data: { name: string; email: string; password: string }) =>
  api.post<AuthResponse>('/auth/register', data)

export const logout = () => api.post('/auth/logout')

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  api.post('/auth/change-password', data)

export const forgotPassword = (data: { email: string }) => api.post('/auth/forgot-password', data)

export const resetPassword = (data: { token: string; password: string }) =>
  api.post('/auth/reset-password', data)

export const silentRefresh = () =>
  axios.post<{ accessToken: string }>(`${import.meta.env.VITE_API_URL}/auth/refresh`, null, {
    withCredentials: true,
  })

export const googleLogin = () => {
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`
}
