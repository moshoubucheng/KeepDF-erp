import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

beforeEach(() => {
  vi.restoreAllMocks()
  // Set a token for auth header injection
  useAuthStore.setState({ token: 'tok_test', isAuthenticated: true })
})

afterEach(() => {
  useAuthStore.setState({ token: null, isAuthenticated: false, user: null, isAdmin: false })
})

describe('api client', () => {
  it('returns data on successful request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ orders: [] }), { status: 200 }),
    )

    const result = await api.get<{ orders: unknown[] }>('/orders')
    expect(result).toEqual({ orders: [] })
  })

  it('injects Bearer token in Authorization header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await api.get('/me')

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[1].headers['Authorization']).toBe('Bearer tok_test')
  })

  it('calls logout on 401 response', async () => {
    // Mock location to prevent navigation error
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 401 }),
    )

    await expect(api.get('/protected')).rejects.toThrow(ApiError)

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('throws ApiError on 4xx errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    )

    try {
      await api.get('/missing')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(404)
      expect((err as ApiError).data.error).toBe('Not found')
    }
  })

  it('throws ApiError on 5xx errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 }),
    )

    await expect(api.get('/error')).rejects.toThrow(ApiError)
  })

  it('sends POST with JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), { status: 200 }),
    )

    await api.post('/orders', { sku: 'ABC', qty: 5 })

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].body).toBe(JSON.stringify({ sku: 'ABC', qty: 5 }))
  })
})
