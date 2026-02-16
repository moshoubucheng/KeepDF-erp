import { api } from '../client'

export interface BatchResult {
  success: number
  errors: { message: string; order_id?: number; id?: number; sku?: string }[]
}

export interface ProductUpdate {
  id: number
  cost_price?: number
  name_jp?: string
  name_cn?: string
}

export interface StockAdjustment {
  sku: string
  qty: number
  reason: string
}

export const batchApi = {
  updateOrderStatus: (data: { order_ids: number[]; status: string }) =>
    api.post<BatchResult>('/batch/orders/status', data),

  updateProducts: (updates: ProductUpdate[]) =>
    api.post<BatchResult>('/batch/products/update', { updates }),

  adjustStock: (adjustments: StockAdjustment[]) =>
    api.post<BatchResult>('/batch/stock/adjust', { adjustments }),
}
