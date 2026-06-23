import { api } from '@/lib/axios'
import type { User } from '@/types'

export const getMe = () => api.get<User>('/user/me')

export const updateMe = (data: { name?: string; email?: string }) =>
  api.patch<User>('/user/me', data)
