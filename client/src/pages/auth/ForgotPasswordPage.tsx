import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import AuthHeader from '@/components/layout/AuthHeader'
import { Button } from '@/components/ui/button'
import { useForgotPasswordForm } from '@/hooks/auth/useForgotPasswordForm'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { register, errors, isSubmitting, submitted, handleSubmit } = useForgotPasswordForm()

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AuthHeader />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {submitted ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                {t('auth.forgotPassword.successTitle')}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('auth.forgotPassword.successMessage')}
              </p>
              <Button asChild className="mt-2 w-full">
                <Link to="/login">{t('auth.forgotPassword.backToLogin')}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight">
                  {t('auth.forgotPassword.title')}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t('auth.forgotPassword.subtitle')}
                </p>
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

                <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
                  {isSubmitting ? t('common.loading') : t('auth.forgotPassword.button')}
                </Button>
              </form>

              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/login">{t('auth.forgotPassword.backToLogin')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
