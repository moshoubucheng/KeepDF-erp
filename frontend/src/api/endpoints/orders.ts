import { api } from '../client'
import type { Order } from '../types'

interface OrdersParams {
  offset?: number
  limit?: number
  platform?: string
  status?: string
}

export const ordersApi = {
  list: (params: OrdersParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset) query.set('offset', String(params.offset))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.platform) query.set('platform', params.platform)
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ orders: Order[]; count: number }>(`/orders${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ order: Order; items: unknown[] }>(`/orders/${id}`),

  ship: (id: number, trackingNumber: string) =>
    api.patch(`/orders/${id}/ship`, { tracking_number: trackingNumber }),

  deliver: (id: number) => api.patch(`/orders/${id}/deliver`),

  cancel: (id: number) => api.patch(`/orders/${id}/cancel`),

  exportCsv: (params: OrdersParams = {}) => {
    const query = new URLSearchParams()
    if (params.platform) query.set('platform', params.platform)
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<string>(`/orders/export${qs ? `?${qs}` : ''}`, true)
  },
}
