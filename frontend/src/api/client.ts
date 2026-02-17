import { useAuthStore } from '@/stores/auth.store'

const API_BASE = '/api/v1'
const REQUEST_TIMEOUT_MS = 30000

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: { error?: string; message?: string },
  ) {
    super(data.error || data.message || `API Error ${status}`)
    this.name = 'ApiError'
  }
}

// Prevent multiple concurrent 401 logouts
let logoutTriggered = false

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (!navigator.onLine) {
    throw new ApiError(0, { error: 'offline' })
  }

  // Add timeout via AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, { error: 'Request timeout' })
    }
    throw new ApiError(0, { error: 'Network error' })
  } finally {
    clearTimeout(timeoutId)
  }

  if (res.status === 401) {
    // Only trigger logout once across concurrent requests
    if (!logoutTriggered) {
      logoutTriggered = true
      setTimeout(() => { logoutTriggered = false }, 1000)
      useAuthStore.getState().logout()
    }
    throw new ApiError(401, { error: 'Unauthorized' })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data)
  }

  if (res.status === 204) return undefined as T

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
}
