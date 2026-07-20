import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useResetPasswordForm } from './useResetPasswordForm'
import { useAuth } from '@/context/AuthContext'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}))

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    resetPassword: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>)
}

function TestForm() {
  const { register, handleSubmit } = useResetPasswordForm('sometoken')
  return (
    <form onSubmit={handleSubmit}>
      <input aria-label="newPassword" type="password" {...register('newPassword')} />
      <input aria-label="confirmPassword" type="password" {...register('confirmPassword')} />
      <button type="submit">Submit</button>
    </form>
  )
}

beforeEach(() => {
  toastError.mockClear()
})

describe('useResetPasswordForm', () => {
  // reset-password.spec.ts already covers the real INVALID_RESET_TOKEN case
  // (an actually-expired token) end to end. This covers the fallback branch —
  // any other failure (e.g. a network error) — which a real expired token
  // can't exercise.
  it('falls back to a generic toast for an error code other than INVALID_RESET_TOKEN', async () => {
    const axiosLikeError = { isAxiosError: true, response: { data: { code: 'SOME_OTHER_CODE' } } }
    mockAuth({ resetPassword: vi.fn().mockRejectedValue(axiosLikeError) })
    render(<TestForm />)

    await userEvent.type(screen.getByLabelText('newPassword'), 'ValidPass1')
    await userEvent.type(screen.getByLabelText('confirmPassword'), 'ValidPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.generic'))
  })
})
