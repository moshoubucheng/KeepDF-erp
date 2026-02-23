import { api } from '../client'

export interface Stocktake {
  id: number
  status: string
  started_at: string | null
  completed_at: string | null
  total_items: number
  discrepancy_count: number
  notes: string | null
  created_by: number
  created_at: string
}

export interface StocktakeItem {
  id: number
  stocktake_id: number
  sku: string
  location_code: string
  expected_qty: number
  actual_qty: number | null
  discrepancy: number | null
  notes: string | null
}

interface ListParams {
  offset?: number
  limit?: number
  status?: string
}

export const stocktakesApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.status) q.set('status', params.status)
    const qs = q.toString()
    return api.get<{ stocktakes: Stocktake[]; total: number }>(`/stocktakes${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) =>
    api.get<{ stocktake: Stocktake; items: StocktakeItem[] }>(`/stocktakes/${id}`),

  create: (notes?: string) =>
    api.post<Stocktake>('/stocktakes', notes ? { notes } : {}),

  start: (id: number) => api.post<Stocktake>(`/stocktakes/${id}/start`),

  countItem: (id: number, data: { sku: string; location_code: string; actual_qty: number; notes?: string }) =>
    api.patch<StocktakeItem>(`/stocktakes/${id}/items`, data),

  complete: (id: number) => api.post<Stocktake>(`/stocktakes/${id}/complete`),

  cancel: (id: number) => api.post<Stocktake>(`/stocktakes/${id}/cancel`),
}
