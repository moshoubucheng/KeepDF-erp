import { api } from '../client'

export interface AutomationRule {
  id: number
  name: string
  type: string
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  is_active: number
  run_count: number
  last_run_at: string | null
  distributor_id: number
  created_at: string
  updated_at: string
}

export interface AutomationLog {
  id: number
  rule_id: number
  trigger_type: string
  status: string
  result: string | null
  created_at: string
}

export const automationApi = {
  list: () => api.get<{ rules: AutomationRule[] }>('/automation'),

  get: (id: number) => api.get<{ rule: AutomationRule }>(`/automation/${id}`),

  create: (data: { name: string; type: string; conditions: Record<string, unknown>; actions: Record<string, unknown> }) =>
    api.post<{ rule: AutomationRule }>('/automation', data),

  update: (id: number, data: Partial<{ name: string; conditions: Record<string, unknown>; actions: Record<string, unknown>; is_active: number }>) =>
    api.put<{ rule: AutomationRule }>(`/automation/${id}`, data),

  delete: (id: number) => api.delete<{ success: boolean }>(`/automation/${id}`),

  run: (id: number) => api.post<{ log: AutomationLog }>(`/automation/${id}/run`),

  evaluateAll: () => api.post<{ evaluated: number; executed: number }>('/automation/evaluate-all'),

  logs: (params: { rule_id?: number; status?: string; offset?: number; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.rule_id) q.set('rule_id', String(params.rule_id))
    if (params.status) q.set('status', params.status)
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return api.get<{ logs: AutomationLog[]; total: number }>(`/automation/logs${qs ? `?${qs}` : ''}`)
  },
}
