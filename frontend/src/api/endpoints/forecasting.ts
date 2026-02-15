import { api } from '../client'

export interface Forecast {
  sku: string
  product_name: string
  current_stock: number
  daily_velocity: number
  days_of_stock: number
  reorder_point: number
  safety_stock: number
  lead_time_days: number
  calculated_at: string
}

export interface ReorderSuggestion {
  sku: string
  product_name: string
  current_stock: number
  predicted_demand: number
  reorder_qty: number
  urgency: string
  days_until_stockout: number
  supplier: string | null
  lead_time_days: number
}

export const forecastingApi = {
  list: (params: { offset?: number; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return api.get<{ forecasts: Forecast[]; total: number }>(`/forecasting${qs ? `?${qs}` : ''}`)
  },

  get: (sku: string) =>
    api.get<{ forecast: Forecast }>(`/forecasting/${encodeURIComponent(sku)}`),

  reorderSuggestions: () =>
    api.get<{ suggestions: ReorderSuggestion[]; count: number }>('/forecasting/reorder-suggestions'),

  calculate: () =>
    api.post<{ success: boolean; calculated: number; errors: number }>('/forecasting/calculate'),

  export: () => {
    const token = localStorage.getItem('erp_token') || ''
    return fetch('/api/v1/forecasting/export', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.text())
  },
}
