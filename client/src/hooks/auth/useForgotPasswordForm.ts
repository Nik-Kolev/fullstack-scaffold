import axios from 'axios'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'

type Fields = { email: string }
type FieldErrors = Partial<Record<keyof Fields, string>>

export function useForgotPasswordForm() {
  const { t } = useTranslation()
  const { forgotPassword } = useAuth()

  const [fields, setFields] = useState<Fields>({ email: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!fields.email) {
      next.email = t('errors.required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      next.email = t('errors.invalidEmail')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFields((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)
    try {
      await forgotPassword(fields)
      setSubmitted(true)
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? (err.response.data.message as string)
          : t('errors.generic')
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return { fields, errors, isLoading, submitted, handleChange, handleSubmit }
}
