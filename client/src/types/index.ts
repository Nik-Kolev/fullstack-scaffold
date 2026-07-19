export type Role = 'user' | 'admin'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  hasPassword: boolean
  createdAt: string
}

export type AuthResponse = {
  accessToken: string
  user: User
}
