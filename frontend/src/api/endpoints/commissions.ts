import { api } from '../client'
import type { Commission, CommissionSettlement } from '../types'

interface SettlementParams {
  page?: number
  limit?: number
  status?: string
}

export const commissionsApi = {
  rates: () =>
    api.get<{ success: boolean; rates: Commission[] }>('/commissions/rates'),

  settlements: (params: SettlementParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ success: boolean; settlements: CommissionSettlement[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/commissions/settlements${qs ? `?${qs}` : ''}`)
  },
}
