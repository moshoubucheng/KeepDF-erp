import { api } from '../client'

export interface Promotion {
  id: number
  name: string
  type: string
  discount_value: number
  buy_quantity: number | null
  get_quantity: number | null
  min_order_amount: number
  min_quantity: number
  applicable_platforms: string | null
  start_date: string
  end_date: string
  max_uses: number
  current_uses: number
  priority: number
  is_active: number
  created_by: number
  created_at: string
}

interface ListParams {
  offset?: number
  limit?: number
  status?: string
}

export const promotionsApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.status) q.set('status', params.status)
    const qs = q.toString()
    return api.get<{ promotions: Promotion[]; total: number }>(`/promotions${qs ? `?${qs}` : ''}`)
  },

  create: (data: Record<string, unknown>) =>
    api.post<Promotion>('/promotions', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.patch<Promotion>(`/promotions/${id}`, data),

  delete: (id: number) => api.delete<{ success: boolean }>(`/promotions/${id}`),

  getApplicable: (orderId: number) =>
    api.get<{ promotions: Promotion[] }>(`/promotions/applicable/${orderId}`),

  applyBest: (orderId: number) =>
    api.post<Record<string, unknown>>(`/promotions/apply/${orderId}`),
}
