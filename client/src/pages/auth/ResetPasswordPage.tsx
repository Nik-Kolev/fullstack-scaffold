import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import AuthHeader from '@/components/layout/AuthHeader'
import { Button } from '@/components/ui/button'
import { useResetPasswordForm } from '@/hooks/auth/useResetPasswordForm'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const { register, errors, isSubmitting, handleSubmit } = useResetPasswordForm(token)

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AuthHeader />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {!token ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-2xl font-bold tracking-tight">{t('auth.resetPassword.title')}</h1>
              <p className="text-muted-foreground text-sm">
                {t('auth.resetPassword.invalidToken')}
              </p>
              <Button asChild className="mt-2 w-full">
                <Link to="/forgot-password">{t('auth.resetPassword.requestNewLink')}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight">
                  {t('auth.resetPassword.title')}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t('auth.resetPassword.subtitle')}
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    {t('common.newPassword')}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={!!errors.newPassword}
                    aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                    className={inputClass}
                    {...register('newPassword')}
                  />
                  {errors.newPassword && (
                    <p id="newPassword-error" role="alert" className="text-destructive text-xs">
                      {errors.newPassword.message}
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
                  {isSubmitting ? t('common.loading') : t('auth.resetPassword.button')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
