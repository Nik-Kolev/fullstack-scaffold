import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/context/AuthContext'
import * as authService from '@/services/auth'

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const { googleExchange } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const code = searchParams.get('code')
  const hasError = searchParams.get('error') === '1'
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const isPopup = window.opener !== null

    if (!code || hasError) {
      if (isPopup) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR' }, window.location.origin)
        window.close()
      } else {
        toast.error(hasError ? t('errors.googleSignInFailed') : t('errors.invalidOAuthCallback'))
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
          toast.error(t('errors.googleSignInFailed'))
          navigate('/login', { replace: true })
        })
    }
  }, [code, hasError, googleExchange, navigate, t])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  )
}
