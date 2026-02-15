import { api } from '../client'

export interface Supplier {
  id: number
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  lead_time_days: number
  is_active: number
  created_at: string
  updated_at: string
}

interface ListParams {
  offset?: number
  limit?: number
  is_active?: number
}

export const suppliersApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.is_active !== undefined) q.set('is_active', String(params.is_active))
    const qs = q.toString()
    return api.get<{ suppliers: Supplier[]; total: number }>(`/suppliers${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ supplier: Supplier }>(`/suppliers/${id}`),

  create: (data: Partial<Supplier>) =>
    api.post<{ success: boolean; supplier: Supplier }>('/suppliers', data),

  update: (id: number, data: Partial<Supplier>) =>
    api.put<{ success: boolean; supplier: Supplier }>(`/suppliers/${id}`, data),

  delete: (id: number) => api.delete<{ success: boolean }>(`/suppliers/${id}`),
}
