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
          api(original).then(resolve).catch(reject)
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post<{ accessToken: string }>(`${BASE_URL}/auth/refresh`, null, {
        withCredentials: true,
      })
      setAccessToken(data.accessToken)
      drainQueue()
      return api(original)
    } catch (refreshError) {
      clearAccessToken()
      drainQueue(refreshError)
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
