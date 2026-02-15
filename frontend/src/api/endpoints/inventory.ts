import { api } from '../client'
import type { Product, ApiResponse } from '../types'

interface InventoryParams {
  page?: number
  limit?: number
  search?: string
}

export const inventoryApi = {
  list: (params: InventoryParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    const qs = query.toString()
    return api.get<{ success: boolean; products: Product[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/inventory${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<ApiResponse<Product>>(`/inventory/${id}`),

  create: (data: { sku: string; name_jp?: string; name_cn?: string; cost_price: number; tax_category: string }) =>
    api.post('/inventory', data),

  update: (id: number, data: Partial<{ sku: string; name_jp: string; name_cn: string; cost_price: number; tax_category: string }>) =>
    api.put(`/inventory/${id}`, data),

  delete: (id: number) => api.delete(`/inventory/${id}`),

  inbound: (data: { sku: string; qty: number; location_code?: string }) =>
    api.post('/inventory/inbound', data),
}
