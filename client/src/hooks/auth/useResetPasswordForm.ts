import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'
import { buildResetPasswordSchema, type ResetPasswordFormValues } from '@/schemas/auth.schema'

export function useResetPasswordForm(token: string) {
  const { t } = useTranslation()
  const { resetPassword } = useAuth()
  const navigate = useNavigate()

  const schema = useMemo(() => buildResetPasswordSchema(t), [t])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: ResetPasswordFormValues) => {
    try {
      await resetPassword({ token, newPassword: data.newPassword })
      toast.success(t('auth.resetPassword.successMessage'))
      navigate('/')
    } catch (err) {
      const code = axios.isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined
      toast.error(
        code === 'INVALID_RESET_TOKEN' ? t('auth.resetPassword.invalidToken') : t('errors.generic'),
      )
    }
  }

  return { register, errors, isSubmitting, handleSubmit: handleSubmit(onSubmit) }
}
