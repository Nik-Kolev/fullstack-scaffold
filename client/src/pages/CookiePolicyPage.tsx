import { useTranslation } from 'react-i18next'

export default function CookiePolicyPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t('pages.cookies.title')}</h1>
      <p className="text-muted-foreground mt-4 text-sm">
        {t('pages.lastUpdated', { year: new Date().getFullYear() })}
      </p>
      <div className="text-muted-foreground mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
          nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
          deserunt mollit anim id est laborum.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
          laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
          architecto beatae vitae dicta sunt explicabo.
        </p>
      </div>
    </div>
  )
}
