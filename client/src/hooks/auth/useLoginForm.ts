import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'
import { buildLoginSchema, passwordRegex, type LoginFormValues } from '@/schemas/auth.schema'

export function useLoginForm() {
  const { t } = useTranslation()
  const { login } = useAuth()

  const schema = useMemo(() => buildLoginSchema(t), [t])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: LoginFormValues) => {
    if (!passwordRegex.test(data.password)) {
      toast.error(t('errors.invalidCredentials')) // no point asking the server — it would 100% reject this shape
      return
    }
    try {
      await login(data)
    } catch (err) {
      const code = axios.isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined
      toast.error(
        code === 'INVALID_CREDENTIALS' ? t('errors.invalidCredentials') : t('errors.generic'),
      )
    }
  }

  return { register, errors, isSubmitting, handleSubmit: handleSubmit(onSubmit) }
}
