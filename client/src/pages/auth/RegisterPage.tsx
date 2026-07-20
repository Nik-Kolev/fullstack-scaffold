import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import AuthHeader from '@/components/layout/AuthHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useRegisterForm } from '@/hooks/auth/useRegisterForm'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

export default function RegisterPage() {
  const { t } = useTranslation()
  const { googleLogin } = useAuth()
  const { register, errors, isSubmitting, handleSubmit } = useRegisterForm()

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AuthHeader />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t('auth.register.title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t('auth.register.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                {t('common.name')}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                className={inputClass}
                {...register('name')}
              />
              {errors.name && (
                <p id="name-error" role="alert" className="text-destructive text-xs">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t('common.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={inputClass}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-destructive text-xs">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                {t('common.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={inputClass}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-destructive text-xs">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t('common.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={inputClass}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" className="text-destructive text-xs">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? t('common.loading') : t('common.register')}
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
            {t('auth.register.googleButton')}
          </Button>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            {t('auth.register.hasAccount')}{' '}
            <Link
              to="/login"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {t('common.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
