import { api } from '../client'
import type { Order, PaginatedResponse, ApiResponse } from '../types'

interface OrdersParams {
  page?: number
  limit?: number
  platform?: string
  status?: string
  search?: string
}

export const ordersApi = {
  list: (params: OrdersParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.platform) query.set('platform', params.platform)
    if (params.status) query.set('status', params.status)
    if (params.search) query.set('search', params.search)
    const qs = query.toString()
    return api.get<PaginatedResponse<Order>>(`/orders${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<ApiResponse<Order>>(`/orders/${id}`),

  ship: (id: number, trackingNumber: string) =>
    api.post(`/orders/${id}/ship`, { tracking_number: trackingNumber }),

  deliver: (id: number) => api.post(`/orders/${id}/deliver`),

  cancel: (id: number) => api.post(`/orders/${id}/cancel`),

  exportCsv: (params: OrdersParams = {}) => {
    const query = new URLSearchParams()
    if (params.platform) query.set('platform', params.platform)
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ success: boolean; csv: string }>(`/orders/export${qs ? `?${qs}` : ''}`)
  },
}
