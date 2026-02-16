import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'

// Reset store between tests
const initialState = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(initialState)
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('auth.store', () => {
  it('initializes with token from localStorage', () => {
    // Store reads from localStorage on module load — already null in test env
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setToken stores token in localStorage and updates state', () => {
    useAuthStore.getState().setToken('tok_abc')

    expect(localStorage.setItem).toHaveBeenCalledWith('erp_token', 'tok_abc')
    expect(useAuthStore.getState().token).toBe('tok_abc')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('login stores token and calls fetchMe', async () => {
    const mockUser = { id: 1, name: 'Test', role: 'admin' as const }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ distributor: mockUser }), { status: 200 }),
    )

    await useAuthStore.getState().login('tok_xyz')

    expect(localStorage.setItem).toHaveBeenCalledWith('erp_token', 'tok_xyz')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('loginWithPassword succeeds and stores token', async () => {
    const mockResponse = { token: 'tok_login', distributor: { language: 'ja' } }
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )
      // fetchMe call after login
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ distributor: { id: 1, name: 'Admin', role: 'admin' } }), { status: 200 }),
      )

    const result = await useAuthStore.getState().loginWithPassword('admin', 'pass123')

    expect(result).toEqual({})
    expect(useAuthStore.getState().token).toBe('tok_login')
  })

  it('loginWithPassword returns requires_2fa when needed', async () => {
    const mockResponse = { requires_2fa: true, temp_token: 'temp_abc' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await useAuthStore.getState().loginWithPassword('user', 'pass')

    expect(result).toEqual({ requires_2fa: true, temp_token: 'temp_abc' })
  })

  it('loginWithPassword throws on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 }),
    )

    await expect(
      useAuthStore.getState().loginWithPassword('bad', 'creds'),
    ).rejects.toThrow('Invalid credentials')
  })

  it('logout clears token and state', () => {
    // Mock window.location
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
    })
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '/',
    })

    useAuthStore.getState().setToken('tok_clear')
    useAuthStore.getState().logout()

    expect(localStorage.removeItem).toHaveBeenCalledWith('erp_token')
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('verify2FA succeeds and calls login', async () => {
    vi.spyOn(globalThis, 'fetch')
      // verify-2fa response
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'tok_2fa' }), { status: 200 }),
      )
      // fetchMe call
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ distributor: { id: 1, name: 'User', role: 'distributor' } }), { status: 200 }),
      )

    await useAuthStore.getState().verify2FA('temp_token', '123456')

    expect(useAuthStore.getState().token).toBe('tok_2fa')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
