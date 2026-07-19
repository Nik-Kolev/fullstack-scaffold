import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

const CONSENT_KEY = 'cookieConsent'

export default function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY))

  if (!visible) return null

  const respond = (value: 'accepted' | 'declined') => {
    localStorage.setItem(CONSENT_KEY, value)
    setVisible(false)
  }

  return (
    <div
      data-testid="cookie-banner"
      className="bg-background fixed right-0 bottom-0 left-0 z-50 border-t px-6 py-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-foreground text-sm">
          {t('cookies.message')}{' '}
          <Link
            to="/cookies"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            {t('cookies.policyLink')}
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => respond('declined')}>
            {t('cookies.decline')}
          </Button>
          <Button size="sm" onClick={() => respond('accepted')}>
            {t('cookies.accept')}
          </Button>
        </div>
      </div>
    </div>
  )
}
