import { api } from '../client'
import type { Customer } from '../types'

interface CustomersParams {
  offset?: number
  limit?: number
  search?: string
  tag?: string
}

export const customersApi = {
  list: (params: CustomersParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset) query.set('offset', String(params.offset))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.tag) query.set('tag', params.tag)
    const qs = query.toString()
    return api.get<{ customers: Customer[]; total: number; count: number }>(`/customers${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ customer: Customer }>(`/customers/${id}`),

  create: (data: Partial<Customer>) =>
    api.post<{ success: boolean; customer: Customer }>('/customers', data),

  update: (id: number, data: Partial<Customer>) =>
    api.put<{ customer: Customer }>(`/customers/${id}`, data),
}
