import { api } from '../client'

export interface PriceRule {
  id: number
  sku: string
  platform: string
  base_price: number
  sale_price: number | null
  valid_from: string | null
  valid_to: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export interface PriceHistory {
  id: number
  sku: string
  platform: string
  old_price: number
  new_price: number
  created_at: string
}

export interface MarginAnalysis {
  sku: string
  platform: string
  cost_price: number
  base_price: number
  margin: number
  margin_percent: number
}

interface ListParams {
  offset?: number
  limit?: number
  sku?: string
  platform?: string
}

export const pricingApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.sku) q.set('sku', params.sku)
    if (params.platform) q.set('platform', params.platform)
    const qs = q.toString()
    return api.get<{ rules: PriceRule[]; total: number }>(`/pricing${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ rule: PriceRule }>(`/pricing/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; rule: PriceRule }>('/pricing', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; rule: PriceRule }>(`/pricing/${id}`, data),

  delete: (id: number) => api.delete<{ success: boolean }>(`/pricing/${id}`),

  history: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.sku) q.set('sku', params.sku)
    if (params.platform) q.set('platform', params.platform)
    const qs = q.toString()
    return api.get<{ history: PriceHistory[]; total: number }>(`/pricing/history${qs ? `?${qs}` : ''}`)
  },

  margins: (params: { sku?: string; platform?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.sku) q.set('sku', params.sku)
    if (params.platform) q.set('platform', params.platform)
    const qs = q.toString()
    return api.get<{ margins: MarginAnalysis[] }>(`/pricing/margins${qs ? `?${qs}` : ''}`)
  },

  export: () => {
    const token = localStorage.getItem('erp_token') || ''
    return fetch('/api/v1/pricing/export', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.text())
  },

  // Aliases used by PricingPage.tsx (page/limit → offset/limit, response shape transform)
  listRules: (params: { page?: number; limit?: number; sku?: string; platform?: string } = {}) => {
    const { page = 1, limit = 20, ...rest } = params
    const offset = (page - 1) * limit
    return pricingApi.list({ offset, limit, ...rest }).then((res) => ({
      data: res.rules,
      pages: Math.ceil((res.total || 0) / limit),
      total: res.total,
    }))
  },

  listHistory: (params: { page?: number; limit?: number; sku?: string; platform?: string } = {}) => {
    const { page = 1, limit = 20, ...rest } = params
    const offset = (page - 1) * limit
    return pricingApi.history({ offset, limit, ...rest }).then((res) => ({
      data: res.history,
      pages: Math.ceil((res.total || 0) / limit),
      total: res.total,
    }))
  },

  listMargins: (params: { page?: number; limit?: number; sku?: string; platform?: string } = {}) => {
    const { page = 1, limit = 20, ...rest } = params
    return pricingApi.margins({ sku: rest.sku, platform: rest.platform }).then((res) => ({
      data: res.margins,
      pages: 1,
      total: res.margins.length,
    }))
  },

  createRule: (data: Record<string, unknown>) => pricingApi.create(data),

  updateRule: (id: number, data: Record<string, unknown>) => pricingApi.update(id, data),

  deleteRule: (id: number) => pricingApi.delete(id),
}
