import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

type Props = {
  requiredRole?: Role
  redirectTo?: string
}

export default function ProtectedRoute({ requiredRole, redirectTo = '/login' }: Props) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to={redirectTo} replace />

  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
