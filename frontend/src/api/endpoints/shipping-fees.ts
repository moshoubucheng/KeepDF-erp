import { api } from '../client'

export interface ShippingFeeTemplate {
  id: number
  name: string
  carrier: string
  region: string
  weight_min_g: number
  weight_max_g: number
  base_fee: number
  per_kg_fee: number
  platform: string | null
  is_active: number
  created_at: string
}

export interface ShippingFee {
  id: number
  order_id: number
  template_id: number | null
  carrier: string
  tracking_number: string | null
  actual_fee: number
  estimated_fee: number
  weight_g: number | null
  reconciled: number
  created_at: string
}

export const shippingFeesApi = {
  listTemplates: (params: { carrier?: string; region?: string; platform?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.carrier) q.set('carrier', params.carrier)
    if (params.region) q.set('region', params.region)
    if (params.platform) q.set('platform', params.platform)
    const qs = q.toString()
    return api.get<{ templates: ShippingFeeTemplate[]; total: number }>(`/shipping-fees/templates${qs ? `?${qs}` : ''}`)
  },

  createTemplate: (data: Record<string, unknown>) =>
    api.post<ShippingFeeTemplate>('/shipping-fees/templates', data),

  updateTemplate: (id: number, data: Record<string, unknown>) =>
    api.patch<ShippingFeeTemplate>(`/shipping-fees/templates/${id}`, data),

  deleteTemplate: (id: number) =>
    api.delete<{ success: boolean }>(`/shipping-fees/templates/${id}`),

  getOrderFees: (orderId: number) =>
    api.get<{ fees: ShippingFee[] }>(`/shipping-fees/orders/${orderId}`),

  recordFee: (data: { order_id: number; carrier: string; actual_fee: number; tracking_number?: string; estimated_fee?: number; weight_g?: number; template_id?: number }) =>
    api.post<ShippingFee>('/shipping-fees', data),

  reconcile: (ids: number[]) =>
    api.post<{ reconciled: number }>('/shipping-fees/reconcile', { ids }),

  report: (params: { platform?: string; startDate?: string; endDate?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.platform) q.set('platform', params.platform)
    if (params.startDate) q.set('startDate', params.startDate)
    if (params.endDate) q.set('endDate', params.endDate)
    const qs = q.toString()
    return api.get<Record<string, unknown>>(`/shipping-fees/report${qs ? `?${qs}` : ''}`)
  },
}
