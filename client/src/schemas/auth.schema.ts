import type { TFunction } from 'i18next'
import { z } from 'zod'

// 8-16 chars, Latin letters/digits only, at least 1 digit — ASCII-only keeps .length byte-accurate
export const passwordRegex = /^(?=.*\d)[a-zA-Z0-9]{8,16}$/

export const buildLoginSchema = (t: TFunction) =>
  z.object({
    email: z.string().min(1, t('errors.required')).email(t('errors.invalidEmail')),
    password: z.string().min(1, t('errors.required')), // shape checked separately in onSubmit, not shown inline
  })

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>
