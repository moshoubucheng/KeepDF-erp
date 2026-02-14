import type { PlatformAdapter, PlatformOrder } from './types'

export class TemuAdapter implements PlatformAdapter {
    platform = 'TEMU' as const

    async fetchOrders(_since: Date): Promise<PlatformOrder[]> {
        // Mock implementation - replace with real Temu API
        return [
            {
                platform_order_id: `TM-SYNC-${Date.now()}-001`,
                platform: 'TEMU',
                items: [{ sku: 'FACE-MASK-30', qty: 2, price: 3800 }],
                total: 7600,
            },
        ]
    }
}
