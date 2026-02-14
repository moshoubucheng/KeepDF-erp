/**
 * Platform adapter interface and shared types
 */

export interface PlatformOrder {
    platform_order_id: string
    platform: 'TIKTOK' | 'TEMU' | 'RAKUTEN'
    items: { sku: string; qty: number; price: number }[]
    total: number
}

export interface PlatformAdapter {
    platform: 'TIKTOK' | 'TEMU' | 'RAKUTEN'
    fetchOrders(since: Date): Promise<PlatformOrder[]>
}
