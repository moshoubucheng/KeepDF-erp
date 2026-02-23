import { api } from '../client'
import type { Commission, CommissionSettlement } from '../types'

interface HistoryParams {
  offset?: number
  limit?: number
  status?: string
}

export const commissionsApi = {
  rates: () =>
    api.get<{ rates: Commission[]; count: number }>('/commissions/rates'),

  history: (params: HistoryParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset != null) query.set('offset', String(params.offset))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ settlements: CommissionSettlement[]; total: number; count: number; hasMore: boolean }>(`/commissions/history${qs ? `?${qs}` : ''}`)
  },

  settle: () =>
    api.post<{ settled: number; total_commission: number }>('/commissions/settle'),
}
