import { api } from '../client'

export interface Coupon {
  id: number
  code: string
  name: string
  type: string
  value: number
  min_order_amount: number
  max_uses: number
  per_user_limit: number
  used_count: number
  platform: string | null
  valid_from: string
  valid_to: string
  is_active: number
  created_by: number
  created_at: string
}

interface ListParams {
  offset?: number
  limit?: number
  platform?: string
  is_active?: number
}

export const couponsApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset != null) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.platform) q.set('platform', params.platform)
    if (params.is_active !== undefined) q.set('is_active', String(params.is_active))
    const qs = q.toString()
    return api.get<{ coupons: Coupon[]; total: number; count: number }>(`/coupons${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ coupon: Coupon }>(`/coupons/${id}`),

  available: (platform?: string) => {
    const q = platform ? `?platform=${platform}` : ''
    return api.get<{ coupons: Coupon[] }>(`/coupons/available${q}`)
  },

  usage: (id: number) =>
    api.get<{ usage: Array<Record<string, unknown>>; total: number }>(`/coupons/${id}/usage`),

  create: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; coupon: Coupon }>('/coupons', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; coupon: Coupon }>(`/coupons/${id}`, data),

  deactivate: (id: number) => api.delete<{ success: boolean; coupon: Coupon }>(`/coupons/${id}`),

  validate: (code: string, orderTotal: number, platform?: string) =>
    api.post<{ valid: boolean; discount?: number; message?: string }>('/coupons/validate', {
      code, order_total: orderTotal, platform,
    }),
}
