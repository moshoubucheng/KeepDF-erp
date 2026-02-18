import { api } from '../client'

export const settingsApi = {
  getConfig: () =>
    api.get<{ config: Record<string, unknown> }>('/settings/config'),

  updateConfig: (data: Record<string, unknown>) =>
    api.put<{ success: boolean; config: Record<string, unknown> }>('/settings/config', data),

  systemInfo: () =>
    api.get<{ counts: Record<string, number>; lastSync: unknown; lastBackup: unknown }>('/settings/system-info'),

  resetPassword: (userId: number, newPassword: string) =>
    api.post<{ success: boolean }>(`/settings/users/${userId}/reset-password`, { new_password: newPassword }),

  disable2FA: (userId: number) =>
    api.post<{ success: boolean }>(`/settings/users/${userId}/disable-2fa`),

  completeOnboarding: () =>
    api.put<{ success: boolean }>('/auth/onboarding/complete'),

  // List users via distributors endpoint
  users: () =>
    api.get<{ distributors: { id: number; name: string; username: string; role: string; totp_enabled: number; created_at: string }[] }>('/distributors'),
}
