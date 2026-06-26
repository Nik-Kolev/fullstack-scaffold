import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'

type Props = {
  redirectTo?: string
}

export default function GuestRoute({ redirectTo = '/' }: Props) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated) return <Navigate to={redirectTo} replace />

  return <Outlet />
}
