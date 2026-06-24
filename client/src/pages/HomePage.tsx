import { useTranslation } from 'react-i18next'

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">{t('pages.home.title')}</h1>
      <p className="text-muted-foreground mt-4 text-lg">{t('pages.home.subtitle')}</p>
    </div>
  )
}
