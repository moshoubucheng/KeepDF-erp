import { api } from '../client'
import type { Return } from '../types'

interface ReturnsParams {
  offset?: number
  limit?: number
  status?: string
}

export const returnsApi = {
  list: (params: ReturnsParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset) query.set('offset', String(params.offset))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ returns: Return[]; total: number }>(`/returns${qs ? `?${qs}` : ''}`)
  },

  create: (data: { order_id: number; reason?: string; notes?: string; refund_type?: string; items: { sku: string; qty: number; unit_price: number; reason?: string }[] }) =>
    api.post<{ success: boolean; return: Return }>('/returns', data),

  approve: (id: number) => api.patch<{ success: boolean; return: Return }>(`/returns/${id}/approve`),
  reject: (id: number, reason?: string) => api.patch<{ success: boolean; return: Return }>(`/returns/${id}/reject`, { reason }),
  receive: (id: number) => api.patch<{ success: boolean; return: Return }>(`/returns/${id}/receive`),
  refund: (id: number) => api.patch<{ success: boolean; return: Return }>(`/returns/${id}/refund`),
}
