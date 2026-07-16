import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'
import { buildForgotPasswordSchema, type ForgotPasswordFormValues } from '@/schemas/auth.schema'

export function useForgotPasswordForm() {
  const { t } = useTranslation()
  const { forgotPassword } = useAuth()
  const [submitted, setSubmitted] = useState(false)

  const schema = useMemo(() => buildForgotPasswordSchema(t), [t])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    try {
      await forgotPassword(data)
      setSubmitted(true)
    } catch {
      // service never throws a named error (never reveals account existence) — generic fallback only
      toast.error(t('errors.generic'))
    }
  }

  return { register, errors, isSubmitting, submitted, handleSubmit: handleSubmit(onSubmit) }
}
