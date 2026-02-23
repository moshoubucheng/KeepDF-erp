import { api } from '../client'

export interface SkuMapping {
  id: number
  local_sku: string
  platform: string
  platform_sku: string
  platform_title: string | null
  platform_description: string | null
  price_sync: number
  stock_sync: number
  is_active: number
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface AiSkuSuggestion {
  local_sku: string
  platform: string
  platform_sku: string
  platform_title: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

interface ListParams {
  offset?: number
  limit?: number
  platform?: string
  local_sku?: string
}

export const skuMappingsApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.platform) q.set('platform', params.platform)
    if (params.local_sku) q.set('local_sku', params.local_sku)
    const qs = q.toString()
    return api.get<{ mappings: SkuMapping[]; total: number; count: number }>(`/sku-mappings${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<{ mapping: SkuMapping }>(`/sku-mappings/${id}`),

  byLocalSku: (sku: string) =>
    api.get<{ mappings: SkuMapping[] }>(`/sku-mappings/by-sku/${encodeURIComponent(sku)}`),

  create: (data: { local_sku: string; platform: string; platform_sku: string; price_sync?: number; stock_sync?: number; platform_title?: string }) =>
    api.post<{ success: boolean; mapping: SkuMapping }>('/sku-mappings', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; mapping: SkuMapping }>(`/sku-mappings/${id}`, data),

  delete: (id: number) => api.delete<{ success: boolean }>(`/sku-mappings/${id}`),

  validate: () =>
    api.get<{ total: number; valid: number; invalid: number; errors: Array<{ mapping_id: number; local_sku: string; platform: string; error: string }> }>(
      '/sku-mappings/validate'
    ),

  bulkImport: (mappings: Array<Record<string, unknown>>) =>
    api.post<{ success: number; errors: Array<{ row: number; error: string }> }>('/sku-mappings/import', { mappings }),

  export: () => {
    const token = localStorage.getItem('erp_token') || ''
    return fetch('/api/v1/sku-mappings/export', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.text())
  },

  aiSuggest: (localSku: string) =>
    api.post<{ success: boolean; suggestions: AiSkuSuggestion[] }>('/sku-mappings/ai-suggest', { local_sku: localSku }),

  aiBulkSuggest: () =>
    api.post<{ success: boolean; suggestions: AiSkuSuggestion[]; productsAnalyzed: number }>('/sku-mappings/ai-bulk-suggest', {}),
}
