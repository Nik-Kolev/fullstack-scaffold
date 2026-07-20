import axios, { type AxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL as string

let accessToken: string | null = null

export const setAccessToken = (token: string) => {
  accessToken = token
}

export const clearAccessToken = () => {
  accessToken = null
}

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean }
type QueueEntry = (err: unknown) => void

// These never carry a Bearer token worth refreshing — /auth/change-password does, so it's excluded here on purpose.
const NON_RETRYABLE_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google/exchange',
]

let isRefreshing = false
let waitQueue: QueueEntry[] = []

// A 401 on the retry means the fresh token was rejected too — the session is genuinely gone.
function handleRetryFailure(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    clearAccessToken()
    window.location.href = '/login'
  }
}

function drainQueue(err: unknown = null) {
  waitQueue.forEach((cb) => cb(err))
  waitQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original: RetryableConfig = error.config

    const isNonRetryableAuthRoute = NON_RETRYABLE_AUTH_PATHS.some((path) =>
      original.url?.includes(path),
    )
    if (error.response?.status !== 401 || original._retry || isNonRetryableAuthRoute) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitQueue.push((err) => {
          if (err) return reject(err)
          original._retry = true
          api(original)
            .then(resolve)
            .catch((retryError) => {
              handleRetryFailure(retryError)
              reject(retryError)
            })
        })
      })
    }

    original._retry = true
    isRefreshing = true

    let refreshedToken: string
    try {
      const { data } = await axios.post<{ accessToken: string }>(`${BASE_URL}/auth/refresh`, null, {
        withCredentials: true,
      })
      refreshedToken = data.accessToken
    } catch (refreshError) {
      clearAccessToken()
      drainQueue(refreshError)
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }

    setAccessToken(refreshedToken)
    drainQueue()

    try {
      return await api(original)
    } catch (retryError) {
      handleRetryFailure(retryError)
      throw retryError
    }
  },
)
