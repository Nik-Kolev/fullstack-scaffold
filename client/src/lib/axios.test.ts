import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// axios.ts keeps refresh state (accessToken, isRefreshing, waitQueue) as private
// module-level closures with no reset hook — vi.resetModules() + a fresh dynamic
// import per test is the only way to get a clean instance each time.
async function loadAxiosModule() {
  vi.resetModules()

  const requestUse = vi.fn()
  const responseUse = vi.fn()
  const apiRequest = vi.fn((config: unknown) => Promise.resolve({ data: {}, config }))
  const mockApi = Object.assign(apiRequest, {
    interceptors: {
      request: { use: requestUse },
      response: { use: responseUse },
    },
  })
  const post = vi.fn()

  vi.doMock('axios', () => ({
    default: {
      create: vi.fn(() => mockApi),
      post,
    },
  }))

  const mod = await import('./axios')

  return {
    ...mod,
    mockApi,
    apiRequest,
    post,
    requestHandler: requestUse.mock.calls[0]?.[0] as (config: {
      headers: Record<string, string>
    }) => unknown,
    responseErrorHandler: responseUse.mock.calls[0]?.[1] as (error: unknown) => unknown,
  }
}

describe('lib/axios request interceptor', () => {
  it('attaches the Authorization header when an access token is set', async () => {
    const { setAccessToken, requestHandler } = await loadAxiosModule()
    setAccessToken('token-123')

    const config = requestHandler({ headers: {} })

    expect((config as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer token-123',
    )
  })

  it('does not attach an Authorization header when no access token is set', async () => {
    const { requestHandler } = await loadAxiosModule()

    const config = requestHandler({ headers: {} })

    expect((config as { headers: Record<string, string> }).headers.Authorization).toBeUndefined()
  })
})

describe('lib/axios response interceptor', () => {
  const originalLocation = window.location

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  function makeError(status: number, url: string, extra: object = {}) {
    return {
      response: { status },
      config: { url, ...extra },
    }
  }

  it('rejects non-401 errors without attempting a refresh', async () => {
    const { responseErrorHandler, post } = await loadAxiosModule()

    await expect(responseErrorHandler(makeError(500, '/product'))).rejects.toBeDefined()
    expect(post).not.toHaveBeenCalled()
  })

  it('rejects a 401 on /auth/login without attempting a refresh', async () => {
    const { responseErrorHandler, post } = await loadAxiosModule()

    await expect(responseErrorHandler(makeError(401, '/auth/login'))).rejects.toBeDefined()
    expect(post).not.toHaveBeenCalled()
  })

  it('rejects a 401 already marked as retried, to avoid an infinite loop', async () => {
    const { responseErrorHandler, post } = await loadAxiosModule()

    await expect(
      responseErrorHandler(makeError(401, '/product', { _retry: true })),
    ).rejects.toBeDefined()
    expect(post).not.toHaveBeenCalled()
  })

  it('attempts a refresh for a 401 on /auth/change-password — not excluded like the other auth routes', async () => {
    const { responseErrorHandler, post, apiRequest } = await loadAxiosModule()
    post.mockResolvedValueOnce({ data: { accessToken: 'new-token' } })

    await responseErrorHandler(makeError(401, '/auth/change-password'))

    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      null,
      expect.objectContaining({ withCredentials: true }),
    )
    expect(apiRequest).toHaveBeenCalledOnce()
  })

  it('retries the original request with the new token after a successful refresh', async () => {
    const { responseErrorHandler, post, apiRequest } = await loadAxiosModule()
    post.mockResolvedValueOnce({ data: { accessToken: 'refreshed-token' } })
    const original = { url: '/product', headers: {} }

    await responseErrorHandler({ response: { status: 401 }, config: original })

    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/product' }))
  })

  it('clears the token and redirects to /login when the refresh itself fails', async () => {
    const { responseErrorHandler, post, setAccessToken } = await loadAxiosModule()
    setAccessToken('stale-token')
    post.mockRejectedValueOnce(new Error('refresh failed'))

    await expect(responseErrorHandler(makeError(401, '/product'))).rejects.toThrow(
      'refresh failed',
    )

    expect(window.location.href).toBe('/login')
  })

  it('queues a second 401 while a refresh is already in flight and resolves it once the refresh completes', async () => {
    const { responseErrorHandler, post, apiRequest } = await loadAxiosModule()
    let resolveRefresh!: (value: { data: { accessToken: string } }) => void
    post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve
      }),
    )

    const first = responseErrorHandler(makeError(401, '/product'))
    const second = responseErrorHandler(makeError(401, '/user/me'))

    resolveRefresh({ data: { accessToken: 'queued-token' } })
    await Promise.all([first, second])

    expect(post).toHaveBeenCalledOnce()
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })
})
