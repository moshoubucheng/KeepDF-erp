import { api } from '../client'
import type { Shipment, ShipmentEvent } from '../types'

interface ShippingParams {
  offset?: number
  limit?: number
  status?: string
  carrier?: string
}

export const shippingApi = {
  list: (params: ShippingParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset) query.set('offset', String(params.offset))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    if (params.carrier) query.set('carrier', params.carrier)
    const qs = query.toString()
    return api.get<{ shipments: Shipment[]; total: number; count: number }>(`/shipping${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ shipment: Shipment }>(`/shipping/${id}`),

  create: (data: { order_id: number; tracking_number: string; carrier: string; estimated_delivery?: string }) =>
    api.post<{ success: boolean; shipment: Shipment }>('/shipping', data),

  updateStatus: (id: number, status: string) =>
    api.patch<{ success: boolean; shipment: Shipment }>(`/shipping/${id}/status`, { status }),

  timeline: (id: number) =>
    api.get<{ events: ShipmentEvent[] }>(`/shipping/${id}/events`),

  trackingUrl: (id: number) =>
    api.get<{ tracking_url: string }>(`/shipping/${id}/tracking-url`),
}
