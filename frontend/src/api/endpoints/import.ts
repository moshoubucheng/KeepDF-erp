import { api } from '../client'
import { useAuthStore } from '@/stores/auth.store'

const API_BASE = '/api/v1'

export interface ImportResult {
  total: number
  success: number
  errors: { message: string; row?: number }[]
}

export interface BatchUpdateResult {
  success: number
  errors: { message: string; order_id?: number }[]
}

export interface ImportLog {
  id: number
  action: string
  resource_type: string
  details: string | null
  created_at: string
}

export const importApi = {
  importProducts: async (file: File): Promise<ImportResult> => {
    const token = useAuthStore.getState().token
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/import/products`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Import failed (${res.status})`)
    }
    return res.json()
  },

  importOrders: async (file: File): Promise<ImportResult> => {
    const token = useAuthStore.getState().token
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/import/orders`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Import failed (${res.status})`)
    }
    return res.json()
  },

  batchUpdateStatus: (updates: { order_id: number; status: string }[]) =>
    api.post<BatchUpdateResult>('/import/batch-update', { updates }),

  getLogs: () => api.get<{ logs: ImportLog[] }>('/import/logs'),

  getProductTemplateUrl: () => `${API_BASE}/import/templates/products`,
  getOrderTemplateUrl: () => `${API_BASE}/import/templates/orders`,
}
