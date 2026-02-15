import { api } from '../client'

export interface WebhookEndpoint {
  id: number
  distributor_id: number
  url: string
  events: string
  secret: string | null
  is_active: number
  last_triggered_at: string | null
  failure_count: number
  created_at: string
  updated_at: string
}

export interface WebhookLog {
  id: number
  endpoint_id: number
  event_type: string
  payload: Record<string, unknown>
  response_status: number | null
  response_body: string | null
  error: string | null
  created_at: string
}

export const webhooksApi = {
  list: () => api.get<{ endpoints: WebhookEndpoint[] }>('/webhooks'),

  create: (data: { url: string; events: string; secret?: string; is_active?: number }) =>
    api.post<WebhookEndpoint>('/webhooks', data),

  update: (id: number, data: { url?: string; events?: string; secret?: string; is_active?: number }) =>
    api.patch<WebhookEndpoint>(`/webhooks/${id}`, data),

  delete: (id: number) => api.delete<{ success: boolean }>(`/webhooks/${id}`),

  logs: (id: number, limit = 50, offset = 0) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    return api.get<{ logs: WebhookLog[]; count: number }>(`/webhooks/${id}/logs?${q.toString()}`)
  },

  test: (id: number) => api.post<{ success: boolean; error?: string }>(`/webhooks/${id}/test`),
}
