import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'
import { buildRegisterSchema, type RegisterFormValues } from '@/schemas/auth.schema'

export function useRegisterForm() {
  const { t } = useTranslation()
  const { register: registerUser } = useAuth()

  const schema = useMemo(() => buildRegisterSchema(t), [t])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await registerUser({ name: data.name, email: data.email, password: data.password })
    } catch (err) {
      const code = axios.isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined
      toast.error(code === 'EMAIL_TAKEN' ? t('errors.emailTaken') : t('errors.generic'))
    }
  }

  return { register, errors, isSubmitting, handleSubmit: handleSubmit(onSubmit) }
}
