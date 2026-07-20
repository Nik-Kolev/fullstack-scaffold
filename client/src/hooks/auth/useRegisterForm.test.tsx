import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRegisterForm } from './useRegisterForm'
import { useAuth } from '@/context/AuthContext'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    register: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>)
}

function TestForm() {
  const { register, handleSubmit } = useRegisterForm()
  return (
    <form onSubmit={handleSubmit}>
      <input aria-label="name" {...register('name')} />
      <input aria-label="email" {...register('email')} />
      <input aria-label="password" type="password" {...register('password')} />
      <input aria-label="confirmPassword" type="password" {...register('confirmPassword')} />
      <button type="submit">Submit</button>
    </form>
  )
}

beforeEach(() => {
  toastError.mockClear()
})

describe('useRegisterForm', () => {
  // register.spec.ts already covers the real EMAIL_TAKEN case end to end.
  // This covers the dispatch table's fallback branch, which a real duplicate
  // registration can never exercise.
  it('falls back to a generic toast for an error code other than EMAIL_TAKEN', async () => {
    const axiosLikeError = { isAxiosError: true, response: { data: { code: 'SOME_OTHER_CODE' } } }
    mockAuth({ register: vi.fn().mockRejectedValue(axiosLikeError) })
    render(<TestForm />)

    await userEvent.type(screen.getByLabelText('name'), 'Test User')
    await userEvent.type(screen.getByLabelText('email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('password'), 'ValidPass1')
    await userEvent.type(screen.getByLabelText('confirmPassword'), 'ValidPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.generic'))
  })
})
