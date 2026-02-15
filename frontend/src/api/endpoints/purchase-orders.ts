import { api } from '../client'

export interface PurchaseOrder {
  id: number
  po_number: string
  supplier_id: number
  supplier_name: string
  status: string
  total_amount: number
  expected_delivery: string | null
  notes: string | null
  created_by: number
  created_at: string
  updated_at: string
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: number
  po_id: number
  sku: string
  qty: number
  unit_cost: number
  received_qty: number
}

interface ListParams {
  offset?: number
  limit?: number
  status?: string
  supplier_id?: number
}

export const purchaseOrdersApi = {
  list: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.status) q.set('status', params.status)
    if (params.supplier_id) q.set('supplier_id', String(params.supplier_id))
    const qs = q.toString()
    return api.get<{ orders: PurchaseOrder[]; total: number }>(`/purchase-orders${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<PurchaseOrder>(`/purchase-orders/${id}`),

  create: (data: { supplier_id: number; items: { sku: string; qty: number; unit_cost: number }[]; notes?: string; expected_delivery?: string }) =>
    api.post<{ success: boolean; order: PurchaseOrder }>('/purchase-orders', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; order: PurchaseOrder }>(`/purchase-orders/${id}`, data),

  updateStatus: (id: number, status: string) =>
    api.patch<{ success: boolean; order: PurchaseOrder }>(`/purchase-orders/${id}/status`, { status }),

  receive: (id: number, items?: { sku: string; received_qty: number }[]) =>
    api.post<{ success: boolean; order: PurchaseOrder }>(`/purchase-orders/${id}/receive`, { items }),

  export: () => {
    const token = localStorage.getItem('erp_token') || ''
    return fetch('/api/v1/purchase-orders/export', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.text())
  },
}
