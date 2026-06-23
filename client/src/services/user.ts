import { api } from '@/lib/axios'
import type { User } from '@/types'

export const getMe = () => api.get<{ user: User }>('/user/me')

export const updateMe = (data: { name?: string; email?: string }) =>
  api.patch<{ user: User }>('/user/me', data)
