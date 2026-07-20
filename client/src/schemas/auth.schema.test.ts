import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'

import {
  buildForgotPasswordSchema,
  buildLoginSchema,
  buildRegisterSchema,
  buildResetPasswordSchema,
  passwordRegex,
} from './auth.schema'

// Returns the translation key itself — these tests assert on schema wiring
// (which key fires for which field), not on the actual translated copy.
const t = ((key: string) => key) as TFunction

function issueMessages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((i) => i.message) ?? []
}

function issuePath(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((i) => i.path.join('.')) ?? []
}

describe('buildLoginSchema', () => {
  const schema = buildLoginSchema(t)

  it('accepts a valid email and non-empty password', () => {
    const result = schema.safeParse({ email: 'user@example.com', password: 'anything' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty email', () => {
    const result = schema.safeParse({ email: '', password: 'x' })
    expect(issueMessages(result)).toContain('errors.required')
  })

  it('rejects a malformed email', () => {
    const result = schema.safeParse({ email: 'not-an-email', password: 'x' })
    expect(issueMessages(result)).toContain('errors.invalidEmail')
  })

  it('rejects an empty password', () => {
    const result = schema.safeParse({ email: 'user@example.com', password: '' })
    expect(issueMessages(result)).toContain('errors.required')
  })

  it('does not enforce the password policy shape — login only checks non-empty, policy is checked separately in onSubmit', () => {
    const result = schema.safeParse({ email: 'user@example.com', password: 'weak' })
    expect(result.success).toBe(true)
  })
})

describe('buildRegisterSchema', () => {
  const schema = buildRegisterSchema(t)
  const valid = {
    name: 'Test User',
    email: 'user@example.com',
    password: 'Password1',
    confirmPassword: 'Password1',
  }

  it('accepts fully valid input', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = schema.safeParse({ ...valid, name: '' })
    expect(issueMessages(result)).toContain('errors.required')
  })

  it('rejects a password that fails the policy regex', () => {
    const result = schema.safeParse({ ...valid, password: 'weak', confirmPassword: 'weak' })
    expect(issueMessages(result)).toContain('errors.passwordMin')
  })

  it('rejects mismatched passwords, attaching the error to confirmPassword', () => {
    const result = schema.safeParse({ ...valid, confirmPassword: 'Different1' })
    expect(issueMessages(result)).toContain('errors.passwordMismatch')
    expect(issuePath(result)).toContain('confirmPassword')
  })

  it('reports only the required error (not also a mismatch) when confirmPassword is empty', () => {
    const result = schema.safeParse({ ...valid, confirmPassword: '' })
    const messages = issueMessages(result)
    expect(messages).toContain('errors.required')
    expect(messages).not.toContain('errors.passwordMismatch')
  })
})

describe('buildForgotPasswordSchema', () => {
  const schema = buildForgotPasswordSchema(t)

  it('accepts a valid email', () => {
    expect(schema.safeParse({ email: 'user@example.com' }).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    const result = schema.safeParse({ email: 'nope' })
    expect(issueMessages(result)).toContain('errors.invalidEmail')
  })
})

describe('buildResetPasswordSchema', () => {
  const schema = buildResetPasswordSchema(t)
  const valid = { newPassword: 'Password1', confirmPassword: 'Password1' }

  it('accepts matching passwords that satisfy the policy', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it('rejects a newPassword that fails the policy regex', () => {
    const result = schema.safeParse({ ...valid, newPassword: 'weak', confirmPassword: 'weak' })
    expect(issueMessages(result)).toContain('errors.passwordMin')
  })

  it('rejects mismatched passwords, attaching the error to confirmPassword', () => {
    const result = schema.safeParse({ ...valid, confirmPassword: 'Different1' })
    expect(issueMessages(result)).toContain('errors.passwordMismatch')
    expect(issuePath(result)).toContain('confirmPassword')
  })
})

describe('passwordRegex', () => {
  it.each([
    ['Password1', true],
    ['password1', true],
    ['12345678', false], // no letter
    ['password', false], // no digit
    ['Pass1', false], // 5 chars — under the 8 minimum
    ['Password12345678', true], // exactly 16 chars — max boundary, inclusive
    ['Password123456789', false], // 17 chars — one over the max
    ['Aa1!@#$%', true], // allowed special chars
    ['Aa1 space', false], // space not allowed
  ])('%s -> %s', (value, expected) => {
    expect(passwordRegex.test(value)).toBe(expected)
  })
})
