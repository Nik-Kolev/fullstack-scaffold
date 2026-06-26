import axios from 'axios'

import { api } from '@/lib/axios'
import type { AuthResponse, User } from '@/types'

export const login = (data: { email: string; password: string }) =>
  api.post<AuthResponse>('/auth/login', data)

export const register = (data: { name: string; email: string; password: string }) =>
  api.post<AuthResponse>('/auth/register', data)

export const logout = () => api.post('/auth/logout')

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  api.post<{ user: User; accessToken: string; message: string }>('/auth/change-password', data)

export const forgotPassword = (data: { email: string }) => api.post('/auth/forgot-password', data)

export const resetPassword = (data: { token: string; newPassword: string }) =>
  api.post<AuthResponse>('/auth/reset-password', data)

export const silentRefresh = () =>
  axios.post<{ accessToken: string }>(`${import.meta.env.VITE_API_URL}/auth/refresh`, null, {
    withCredentials: true,
  })

export const exchangeGoogleCode = (code: string) =>
  api.post<AuthResponse>('/auth/google/exchange', { code })
