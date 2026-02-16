import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/api/client'

// Must mock before importing query-config
vi.mock('@/stores/ui.store', () => ({
  useUIStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}))

// Dynamic import to ensure mocks are set up first
async function importQueryConfig() {
  const mod = await import('@/api/query-config')
  return mod
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('shouldRetry (via defaultOptions)', () => {
  it('does not retry 4xx client errors', async () => {
    const { createQueryClient } = await importQueryConfig()
    const client = createQueryClient()
    const retryFn = client.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean

    const error = new ApiError(400, { error: 'Bad request' })
    expect(retryFn(0, error)).toBe(false)
    expect(retryFn(1, error)).toBe(false)
  })

  it('does not retry 404 errors', async () => {
    const { createQueryClient } = await importQueryConfig()
    const client = createQueryClient()
    const retryFn = client.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean

    const error = new ApiError(404, { error: 'Not found' })
    expect(retryFn(0, error)).toBe(false)
  })

  it('retries 5xx server errors up to 3 times', async () => {
    const { createQueryClient } = await importQueryConfig()
    const client = createQueryClient()
    const retryFn = client.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean

    const error = new ApiError(500, { error: 'Server error' })
    expect(retryFn(0, error)).toBe(true)
    expect(retryFn(1, error)).toBe(true)
    expect(retryFn(2, error)).toBe(true)
    expect(retryFn(3, error)).toBe(false) // exceeds max
  })

  it('retries network errors', async () => {
    const { createQueryClient } = await importQueryConfig()
    const client = createQueryClient()
    const retryFn = client.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean

    const error = new Error('Network error')
    expect(retryFn(0, error)).toBe(true)
    expect(retryFn(2, error)).toBe(true)
    expect(retryFn(3, error)).toBe(false)
  })
})

describe('retryDelay (via defaultOptions)', () => {
  it('uses exponential backoff capped at 8000ms', async () => {
    const { createQueryClient } = await importQueryConfig()
    const client = createQueryClient()
    const retryDelayFn = client.getDefaultOptions().queries?.retryDelay as (attempt: number) => number

    // Attempt 0: base = min(1000, 8000) = 1000, + jitter(0-500) → [1000, 1500]
    const delay0 = retryDelayFn(0)
    expect(delay0).toBeGreaterThanOrEqual(1000)
    expect(delay0).toBeLessThanOrEqual(1500)

    // Attempt 1: base = min(2000, 8000) = 2000, + jitter → [2000, 2500]
    const delay1 = retryDelayFn(1)
    expect(delay1).toBeGreaterThanOrEqual(2000)
    expect(delay1).toBeLessThanOrEqual(2500)

    // Attempt 3: base = min(8000, 8000) = 8000, + jitter → [8000, 8500]
    const delay3 = retryDelayFn(3)
    expect(delay3).toBeGreaterThanOrEqual(8000)
    expect(delay3).toBeLessThanOrEqual(8500)
  })
})

describe('createQueryClient', () => {
  it('returns a valid QueryClient instance', async () => {
    const { createQueryClient } = await importQueryConfig()
    const client = createQueryClient()
    expect(client).toBeDefined()
    expect(client.getDefaultOptions()).toBeDefined()
    expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000)
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})
