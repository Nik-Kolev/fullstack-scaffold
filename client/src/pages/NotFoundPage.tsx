import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-muted-foreground/30 text-[12rem] leading-none font-bold">404</p>
      <h1 className="text-3xl font-bold">{t('pages.notFound.title')}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t('pages.notFound.message')}</p>
      <Button asChild>
        <Link to="/">{t('pages.notFound.goHome')}</Link>
      </Button>
    </div>
  )
}
