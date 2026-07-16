import type { TFunction } from 'i18next'
import { z } from 'zod'

// 8-16 chars, at least 1 letter + 1 digit, optional !@#$%^&*_- — ASCII-only keeps .length byte-accurate
export const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9!@#$%^&*_-]{8,16}$/

export const buildLoginSchema = (t: TFunction) =>
  z.object({
    email: z.string().min(1, t('errors.required')).email(t('errors.invalidEmail')),
    password: z.string().min(1, t('errors.required')), // shape checked separately in onSubmit, not shown inline
  })

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

export const buildRegisterSchema = (t: TFunction) =>
  z
    .object({
      name: z.string().min(1, t('errors.required')),
      email: z.string().min(1, t('errors.required')).email(t('errors.invalidEmail')),
      password: z
        .string()
        .min(1, t('errors.required'))
        .regex(passwordRegex, t('errors.passwordMin')),
      confirmPassword: z.string().min(1, t('errors.required')),
    })
    .refine((values) => !values.confirmPassword || values.confirmPassword === values.password, {
      message: t('errors.passwordMismatch'),
      path: ['confirmPassword'],
    })

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>

export const buildForgotPasswordSchema = (t: TFunction) =>
  z.object({
    email: z.string().min(1, t('errors.required')).email(t('errors.invalidEmail')),
  })

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof buildForgotPasswordSchema>>

export const buildResetPasswordSchema = (t: TFunction) =>
  z
    .object({
      newPassword: z
        .string()
        .min(1, t('errors.required'))
        .regex(passwordRegex, t('errors.passwordMin')),
      confirmPassword: z.string().min(1, t('errors.required')),
    })
    .refine((values) => !values.confirmPassword || values.confirmPassword === values.newPassword, {
      message: t('errors.passwordMismatch'),
      path: ['confirmPassword'],
    })

export type ResetPasswordFormValues = z.infer<ReturnType<typeof buildResetPasswordSchema>>
