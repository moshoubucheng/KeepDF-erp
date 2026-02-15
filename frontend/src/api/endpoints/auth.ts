import { api } from '../client'
import type { User, Notification } from '../types'

export const authApi = {
  me: () => api.get<{ success: boolean; distributor: User }>('/auth/me'),

  updateProfile: (data: Partial<{ name: string; email: string; phone: string; address: string; contact_person: string; tax_reg_number: string }>) =>
    api.put('/auth/profile', data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', data),

  setup2FA: () =>
    api.post<{ success: boolean; secret: string; qr_url: string }>('/auth/2fa/setup'),

  enable2FA: (code: string) =>
    api.post('/auth/2fa/enable', { code }),

  disable2FA: (code: string) =>
    api.post('/auth/2fa/disable', { code }),

  notifications: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return api.get<{ success: boolean; notifications: Notification[]; unread_count: number }>(`/notifications${qs ? `?${qs}` : ''}`)
  },

  markAllRead: () => api.post('/notifications/read-all'),
}
