import axios from 'axios'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/context/AuthContext'

const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/

type Fields = { newPassword: string; confirmPassword: string }
type FieldErrors = Partial<Record<keyof Fields, string>>

export function useResetPasswordForm(token: string) {
  const { t } = useTranslation()
  const { resetPassword } = useAuth()
  const navigate = useNavigate()

  const [fields, setFields] = useState<Fields>({ newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!fields.newPassword) {
      next.newPassword = t('errors.required')
    } else if (!passwordRegex.test(fields.newPassword)) {
      next.newPassword = t('errors.passwordMin')
    }
    if (!fields.confirmPassword) {
      next.confirmPassword = t('errors.required')
      // guard prevents a false mismatch error when confirmPassword is filled but newPassword is still empty
    } else if (fields.newPassword && fields.confirmPassword !== fields.newPassword) {
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
      await resetPassword({ token, newPassword: fields.newPassword })
      toast.success(t('auth.resetPassword.successMessage'))
      navigate('/')
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
