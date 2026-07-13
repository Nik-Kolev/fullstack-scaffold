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
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? (err.response.data.message as string)
          : t('errors.generic')
      toast.error(message)
    }
  }

  return { register, errors, isSubmitting, handleSubmit: handleSubmit(onSubmit) }
}
