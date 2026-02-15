import { api } from '../client'
import type { Return } from '../types'

interface ReturnsParams {
  page?: number
  limit?: number
  status?: string
}

export const returnsApi = {
  list: (params: ReturnsParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ success: boolean; returns: Return[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/returns${qs ? `?${qs}` : ''}`)
  },

  approve: (id: number) => api.post(`/returns/${id}/approve`),
  reject: (id: number, reason: string) => api.post(`/returns/${id}/reject`, { reason }),
  receive: (id: number) => api.post(`/returns/${id}/receive`),
  refund: (id: number) => api.post(`/returns/${id}/refund`),
}
