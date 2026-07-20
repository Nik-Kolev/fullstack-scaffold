import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { AuthProvider, useAuth } from './AuthContext'
import * as authService from '@/services/auth'
import type { AuthResponse } from '@/types'

vi.mock('@/services/auth')
vi.mock('@/services/user', () => ({ getMe: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'user' as const,
  hasPassword: true,
  createdAt: new Date().toISOString(),
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

async function renderAuthHook() {
  const view = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(view.result.current.isLoading).toBe(false))
  return view
}

beforeEach(() => {
  localStorage.clear()
  toastError.mockClear()
  // Default: no valid session — most tests don't care about the initial silent refresh.
  vi.mocked(authService.silentRefresh).mockRejectedValue(new Error('no session'))
})

afterEach(() => {
  vi.restoreAllMocks()
  // A no-op when timers are already real — but if the fake-timer test below
  // throws before its own vi.useRealTimers() call, this still guarantees
  // real timers for every test that runs after it.
  vi.useRealTimers()
})

describe('AuthProvider init', () => {
  it('starts with a null user (not a crash) when localStorage holds corrupted JSON', async () => {
    localStorage.setItem('user', '{not valid json')

    const { result } = await renderAuthHook()

    expect(result.current.user).toBeNull()
  })
})

describe('logout', () => {
  it('still clears local user state even when the logout request fails', async () => {
    localStorage.setItem('user', JSON.stringify(mockUser))
    vi.mocked(authService.silentRefresh).mockRejectedValue(new Error('no session'))
    vi.mocked(authService.logout).mockRejectedValue(new Error('network error'))

    const { result } = await renderAuthHook()

    await expect(act(() => result.current.logout())).rejects.toThrow('network error')

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })
})

describe('googleLogin popup flow', () => {
  // Window.closed is readonly in the DOM lib types; this fake only needs to
  // satisfy the one property googleLogin actually reads, so it deliberately
  // isn't typed as Window — that type is only asserted at the mockReturnValue
  // call sites below, where a real Window-shaped value is expected.
  function fakePopup(initialClosed = false) {
    return { closed: initialClosed }
  }

  it('shows a popup-blocked toast and attaches no listener when window.open returns null', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const { result } = await renderAuthHook()

    act(() => result.current.googleLogin())

    expect(toastError).toHaveBeenCalledWith('errors.popupBlocked')
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('ignores a message from an untrusted origin', async () => {
    vi.spyOn(window, 'open').mockReturnValue(fakePopup() as unknown as Window)
    const { result } = await renderAuthHook()
    act(() => result.current.googleLogin())

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://attacker.example',
          data: { type: 'GOOGLE_AUTH_SUCCESS', payload: { accessToken: 'x', user: mockUser } },
        }),
      )
    })

    expect(result.current.user).toBeNull()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('logs the user in on a same-origin GOOGLE_AUTH_SUCCESS message', async () => {
    vi.spyOn(window, 'open').mockReturnValue(fakePopup() as unknown as Window)
    const { result } = await renderAuthHook()
    act(() => result.current.googleLogin())

    const payload: AuthResponse = { accessToken: 'new-token', user: mockUser }
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'GOOGLE_AUTH_SUCCESS', payload },
        }),
      )
    })

    expect(result.current.user).toEqual(mockUser)
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser)
  })

  it('shows a sign-in-failed toast on a same-origin GOOGLE_AUTH_ERROR message', async () => {
    vi.spyOn(window, 'open').mockReturnValue(fakePopup() as unknown as Window)
    const { result } = await renderAuthHook()
    act(() => result.current.googleLogin())

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'GOOGLE_AUTH_ERROR' },
        }),
      )
    })

    expect(toastError).toHaveBeenCalledWith('errors.googleSignInFailed')
    expect(result.current.user).toBeNull()
  })

  it('removes the message listener once the popup is closed without ever sending a message', async () => {
    const popup = fakePopup(false)
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { result } = await renderAuthHook()

    // Fake timers only from here — renderAuthHook()'s internal waitFor needs
    // real timers to poll, so switching earlier would hang it indefinitely.
    vi.useFakeTimers()
    act(() => result.current.googleLogin())
    popup.closed = true
    act(() => {
      vi.advanceTimersByTime(600) // past the 500ms poll interval
    })

    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))

    // A message arriving after cleanup must have no effect — proves the
    // listener was actually detached, not just that cleanup ran.
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'GOOGLE_AUTH_ERROR' },
        }),
      )
    })
    expect(toastError).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
