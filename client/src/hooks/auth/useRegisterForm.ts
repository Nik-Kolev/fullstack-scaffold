import axios from 'axios'
import { useState } from 'react'

const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'

type Fields = { name: string; email: string; password: string; confirmPassword: string }
type FieldErrors = Partial<Record<keyof Fields, string>>

export function useRegisterForm() {
  const { t } = useTranslation()
  const { register } = useAuth()

  const [fields, setFields] = useState<Fields>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const validate = (): boolean => {
    const next: FieldErrors = {}

    if (!fields.name) next.name = t('errors.required')

    if (!fields.email) {
      next.email = t('errors.required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      next.email = t('errors.invalidEmail')
    }

    if (!fields.password) {
      next.password = t('errors.required')
    } else if (!passwordRegex.test(fields.password)) {
      next.password = t('errors.passwordMin')
    }

    if (!fields.confirmPassword) {
      next.confirmPassword = t('errors.required')
    } else if (fields.password && fields.confirmPassword !== fields.password) {
      next.confirmPassword = t('errors.passwordMismatch')
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
      await register({ name: fields.name, email: fields.email, password: fields.password })
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

  return { fields, errors, isLoading, handleChange, handleSubmit }
}
