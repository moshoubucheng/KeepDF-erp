import type { PlatformAdapter, PlatformOrder } from './types'

export class RakutenAdapter implements PlatformAdapter {
    platform = 'RAKUTEN' as const

    async fetchOrders(_since: Date): Promise<PlatformOrder[]> {
        // Mock implementation - replace with real Rakuten API
        return [
            {
                platform_order_id: `RK-SYNC-${Date.now()}-001`,
                platform: 'RAKUTEN',
                items: [
                    { sku: 'RICE-5KG', qty: 1, price: 2800 },
                    { sku: 'MATCHA-100G', qty: 2, price: 2200 },
                ],
                total: 7200,
            },
        ]
    }
}
