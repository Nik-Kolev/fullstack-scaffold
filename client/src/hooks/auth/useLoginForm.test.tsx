import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLoginForm } from './useLoginForm'
import { useAuth } from '@/context/AuthContext'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), ...overrides } as ReturnType<typeof useAuth>)
}

function TestForm() {
  const { register, handleSubmit } = useLoginForm()
  return (
    <form onSubmit={handleSubmit}>
      <input aria-label="email" {...register('email')} />
      <input aria-label="password" type="password" {...register('password')} />
      <button type="submit">Submit</button>
    </form>
  )
}

beforeEach(() => {
  toastError.mockClear()
})

describe('useLoginForm', () => {
  // login.spec.ts already covers the specific INVALID_CREDENTIALS case (a real
  // wrong-password attempt) end to end. What it can't easily reach is the
  // fallback branch for a code the server doesn't actually send for this
  // route — that only shows up if the dispatch table itself regresses.
  it('falls back to a generic toast for an error code other than INVALID_CREDENTIALS', async () => {
    const axiosLikeError = { isAxiosError: true, response: { data: { code: 'SOME_OTHER_CODE' } } }
    mockAuth({ login: vi.fn().mockRejectedValue(axiosLikeError) })
    render(<TestForm />)

    await userEvent.type(screen.getByLabelText('email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('password'), 'ValidPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.generic'))
  })
})
