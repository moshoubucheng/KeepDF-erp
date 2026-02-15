import { api } from '../client'
import type { Shipment, ShipmentEvent } from '../types'

interface ShippingParams {
  page?: number
  limit?: number
  status?: string
}

export const shippingApi = {
  list: (params: ShippingParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<{ success: boolean; shipments: Shipment[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/shipping${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ success: boolean; shipment: Shipment }>(`/shipping/${id}`),

  create: (data: { order_id: number; tracking_number: string; carrier: string; estimated_delivery?: string }) =>
    api.post('/shipping', data),

  updateStatus: (id: number, status: string) =>
    api.put(`/shipping/${id}/status`, { status }),

  timeline: (id: number) =>
    api.get<{ success: boolean; events: ShipmentEvent[] }>(`/shipping/${id}/events`),
}
