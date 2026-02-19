import { api } from '../client'
import type { Product } from '../types'

export const inventoryApi = {
  list: () =>
    api.get<{ products: (Product & { total_stock: number })[] }>('/inventory'),

  get: (sku: string) =>
    api.get<{ product: Product; locations: { code: string; qty: number }[]; platformMappings: { platform: string; platform_sku: string }[] }>(`/inventory/${encodeURIComponent(sku)}`),

  create: (data: { sku: string; name_jp?: string; name_cn?: string; cost_price: number; tax_category?: string }) =>
    api.post<{ status: string; sku: string }>('/inventory/products', data),

  update: (id: number, data: Partial<{ name_jp: string; name_cn: string; cost_price: number; tax_category: string; image_url: string }>) =>
    api.put<{ product: Product }>(`/inventory/products/${id}`, data),

  delete: (id: number) =>
    api.delete<{ status: string; id: number }>(`/inventory/products/${id}`),

  inbound: (data: { sku: string; location_code: string; expected_qty: number; actual_qty: number }) =>
    api.post<{ status: string; sku: string; actual: number }>('/inventory/inbound', data),

  barcodeLookup: (code: string) =>
    api.get<{ product: Product; locations: { code: string; qty: number }[]; totalStock: number }>(`/inventory/barcode-lookup/${encodeURIComponent(code)}`),

  variants: (productId: number) =>
    api.get<{ variants: unknown[] }>(`/inventory/products/${productId}/variants`),

  createVariant: (productId: number, data: { sku: string; color?: string; size?: string; stock_qty?: number }) =>
    api.post(`/inventory/products/${productId}/variants`, data),
}
