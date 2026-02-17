import { create } from 'zustand'
import { api, ApiError } from '@/api/client'
import type { User } from '@/api/types'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  login: (token: string) => Promise<void>
  loginWithPassword: (username: string, password: string) => Promise<{ requires_2fa?: boolean; temp_token?: string }>
  verify2FA: (tempToken: string, code: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('erp_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('erp_token'),
  isAdmin: false,
  isLoading: false,

  setToken: (token: string) => {
    localStorage.setItem('erp_token', token)
    set({ token, isAuthenticated: true })
  },

  login: async (token: string) => {
    localStorage.setItem('erp_token', token)
    set({ token, isAuthenticated: true })
    await get().fetchMe()
  },

  loginWithPassword: async (username: string, password: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Login failed')
    }

    if (data.requires_2fa) {
      return { requires_2fa: true, temp_token: data.temp_token }
    }

    if (data.token) {
      await get().login(data.token)
      if (data.distributor?.language) {
        localStorage.setItem('erp_lang', data.distributor.language)
      }
    }

    return {}
  },

  verify2FA: async (tempToken: string, code: string) => {
    const res = await fetch('/api/v1/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token: tempToken, code }),
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Verification failed')
    }

    if (data.token) {
      await get().login(data.token)
      if (data.distributor?.language) {
        localStorage.setItem('erp_lang', data.distributor.language)
      }
    }
  },

  logout: () => {
    localStorage.removeItem('erp_token')
    set({ token: null, user: null, isAuthenticated: false, isAdmin: false })
    window.location.href = '/login'
  },

  fetchMe: async () => {
    set({ isLoading: true })
    try {
      const data = await api.get<{ distributor: User }>('/auth/me')
      const user = data.distributor
      set({
        user,
        isAdmin: user.role === 'admin',
        isLoading: false,
      })
    } catch (err) {
      // Only logout on 401 (invalid/expired token), not on network errors
      if (err instanceof ApiError && err.status === 401) {
        get().logout()
      } else {
        set({ isLoading: false })
      }
    }
  },
}))
