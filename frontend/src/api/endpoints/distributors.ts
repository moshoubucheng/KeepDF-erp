import { api } from '../client'

export interface Distributor {
  id: number
  name: string
  username: string | null
  role: 'admin' | 'distributor'
  balance: number
  frozen_balance: number
  tax_reg_number: string | null
  totp_enabled: number
  created_at: string
}

interface DistributorsParams {
  offset?: number
  limit?: number
}

export const distributorsApi = {
  list: (params: DistributorsParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return api.get<{
      distributors: Distributor[]
      total: number
      count: number
      hasMore: boolean
    }>(`/distributors${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) =>
    api.get<{ distributor: Distributor; orderCount: number; commissionTotal: number }>(`/distributors/${id}`),

  create: (data: {
    name: string
    username?: string
    password?: string
    tax_reg_number?: string
    role?: 'admin' | 'distributor'
  }) => api.post<{ success: boolean; distributor: Distributor }>('/distributors', data),

  update: (id: number, data: { name?: string; tax_reg_number?: string; role?: 'admin' | 'distributor' }) =>
    api.put<{ success: boolean; distributor: Distributor }>(`/distributors/${id}`, data),

  resetToken: (id: number) =>
    api.post<{ success: boolean; token: string }>(`/distributors/${id}/reset-token`),
}
