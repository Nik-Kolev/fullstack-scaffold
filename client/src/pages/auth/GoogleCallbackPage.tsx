import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'
import * as authService from '@/services/auth'

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const { googleExchange } = useAuth()
  const navigate = useNavigate()
  const code = searchParams.get('code')
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const isPopup = window.opener !== null

    if (!code) {
      if (isPopup) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR' }, window.location.origin)
        window.close()
      } else {
        toast.error('Invalid OAuth callback.')
        navigate('/login', { replace: true })
      }
      return
    }

    if (isPopup) {
      authService
        .exchangeGoogleCode(code)
        .then(({ data }) => {
          window.opener.postMessage(
            { type: 'GOOGLE_AUTH_SUCCESS', payload: data },
            window.location.origin,
          )
          window.close()
        })
        .catch(() => {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR' }, window.location.origin)
          window.close()
        })
    } else {
      googleExchange(code)
        .then(() => navigate('/', { replace: true }))
        .catch(() => {
          toast.error('Google sign-in failed. Please try again.')
          navigate('/login', { replace: true })
        })
    }
  }, [code, googleExchange, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  )
}
