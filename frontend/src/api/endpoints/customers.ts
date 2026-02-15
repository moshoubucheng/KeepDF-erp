import { api } from '../client'
import type { Customer } from '../types'

interface CustomersParams {
  page?: number
  limit?: number
  search?: string
}

export const customersApi = {
  list: (params: CustomersParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    const qs = query.toString()
    return api.get<{ success: boolean; customers: Customer[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/customers${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ success: boolean; customer: Customer }>(`/customers/${id}`),

  create: (data: Partial<Customer>) => api.post('/customers', data),

  update: (id: number, data: Partial<Customer>) => api.put(`/customers/${id}`, data),

  delete: (id: number) => api.delete(`/customers/${id}`),
}
