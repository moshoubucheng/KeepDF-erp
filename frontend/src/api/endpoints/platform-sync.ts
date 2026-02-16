import { api } from '../client'

export interface SyncResult {
  success: boolean
  platform: string
  ordersFetched: number
  ordersQueued: number
}

export interface SyncLog {
  id: number
  platform: string
  trigger: string
  status: string
  orders_fetched: number
  orders_created: number
  errors: string | null
  started_at: string
  completed_at: string | null
}

export const platformSyncApi = {
  sync: (platform: string) =>
    api.post<SyncResult>(`/platform-sync/${platform}`),

  logs: (params?: { platform?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.platform) query.set('platform', params.platform)
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return api.get<{ logs: SyncLog[]; count: number }>(
      `/platform-sync/logs${qs ? `?${qs}` : ''}`,
    )
  },
}
