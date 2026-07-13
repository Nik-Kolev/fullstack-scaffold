import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import AuthHeader from '@/components/layout/AuthHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useLoginForm } from '@/hooks/auth/useLoginForm'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

export default function LoginPage() {
  const { t } = useTranslation()
  const { googleLogin } = useAuth()
  const { register, errors, isSubmitting, handleSubmit } = useLoginForm()

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AuthHeader />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t('auth.login.title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t('auth.login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t('common.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                {...register('email')}
              />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  {t('common.password')}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={inputClass}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-xs">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? t('common.loading') : t('common.login')}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background text-muted-foreground px-2 text-xs uppercase">
                {t('common.or')}
              </span>
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={googleLogin}>
            {t('auth.login.googleButton')}
          </Button>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            {t('auth.login.noAccount')}{' '}
            <Link
              to="/register"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {t('common.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
