import type { PlatformAdapter, PlatformOrder } from './types'

export class TikTokAdapter implements PlatformAdapter {
    platform = 'TIKTOK' as const

    async fetchOrders(_since: Date): Promise<PlatformOrder[]> {
        // Mock implementation - replace with real TikTok Shop API
        return [
            {
                platform_order_id: `TT-SYNC-${Date.now()}-001`,
                platform: 'TIKTOK',
                items: [{ sku: 'CARROT-500ML', qty: 3, price: 1200 }],
                total: 3600,
            },
            {
                platform_order_id: `TT-SYNC-${Date.now()}-002`,
                platform: 'TIKTOK',
                items: [{ sku: 'FACE-MASK-30', qty: 1, price: 3800 }],
                total: 3800,
            },
        ]
    }
}
