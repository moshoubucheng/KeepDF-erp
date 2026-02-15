import { api } from '../client'

export const settingsApi = {
  getAll: () =>
    api.get<{ success: boolean; settings: Record<string, string>; tables?: { name: string; count: number }[] }>('/settings'),

  update: (data: Record<string, string>) =>
    api.put('/settings', data),

  users: () =>
    api.get<{ success: boolean; users: { id: number; name: string; username: string; role: string; totp_enabled: number; created_at: string }[] }>('/settings/users'),

  resetPassword: (userId: number, newPassword: string) =>
    api.post(`/settings/users/${userId}/reset-password`, { new_password: newPassword }),

  disable2FA: (userId: number) =>
    api.post(`/settings/users/${userId}/disable-2fa`),

  completeOnboarding: () =>
    api.post('/settings', { onboarding_completed: '1' }),
}
