import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useForgotPasswordForm } from './useForgotPasswordForm'
import { useAuth } from '@/context/AuthContext'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    forgotPassword: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>)
}

function TestForm() {
  const { register, handleSubmit, submitted } = useForgotPasswordForm()
  return (
    <form onSubmit={handleSubmit}>
      <input aria-label="email" {...register('email')} />
      <button type="submit">Submit</button>
      {submitted && <p>submitted</p>}
    </form>
  )
}

beforeEach(() => {
  toastError.mockClear()
})

describe('useForgotPasswordForm', () => {
  // The real backend always 200s here regardless of whether the account exists
  // (deliberately, to avoid leaking account existence) — so this catch branch
  // is essentially unreachable through the real API, and only e2e-testable via
  // a mocked network failure. Worth covering directly at this level instead.
  it('shows a generic toast and leaves submitted false when the request fails for any reason', async () => {
    mockAuth({ forgotPassword: vi.fn().mockRejectedValue(new Error('network error')) })
    render(<TestForm />)

    await userEvent.type(screen.getByLabelText('email'), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.generic'))
    expect(screen.queryByText('submitted')).not.toBeInTheDocument()
  })

  it('sets submitted to true on success, without showing an error toast', async () => {
    mockAuth({ forgotPassword: vi.fn().mockResolvedValue(undefined) })
    render(<TestForm />)

    await userEvent.type(screen.getByLabelText('email'), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(screen.getByText('submitted')).toBeInTheDocument())
    expect(toastError).not.toHaveBeenCalled()
  })
})
