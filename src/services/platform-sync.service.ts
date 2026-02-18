import type { PlatformAdapter, PlatformOrder } from './platform-sync'
import { TikTokAdapter, TemuAdapter, RakutenAdapter } from './platform-sync'

const ADAPTERS: Record<string, () => PlatformAdapter> = {
    TIKTOK: () => new TikTokAdapter(),
    TEMU: () => new TemuAdapter(),
    RAKUTEN: () => new RakutenAdapter(),
}

export class PlatformSyncService {
    constructor(
        private db: D1Database,
        private queue: Queue,
    ) {}

    async syncPlatform(platform: string, syncType: 'MANUAL' | 'CRON' = 'MANUAL') {
        const adapterFactory = ADAPTERS[platform]
        if (!adapterFactory) {
            throw new Error(`Unsupported platform: ${platform}`)
        }

        // Create sync log
        const { meta } = await this.db.prepare(
            `INSERT INTO platform_sync_logs (platform, sync_type) VALUES (?, ?)`
        ).bind(platform, syncType).run()
        const logId = meta.last_row_id

        try {
            const adapter = adapterFactory()
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h
            const orders = await adapter.fetchOrders(since)

            // Deduplicate: check existing platform_order_ids
            const newOrders: PlatformOrder[] = []
            for (const order of orders) {
                const existing = await this.db.prepare(
                    'SELECT id FROM orders WHERE platform_order_id = ?'
                ).bind(order.platform_order_id).first()

                if (!existing) {
                    newOrders.push(order)
                }
            }

            // Resolve default distributor_id (admin) for platform-synced orders
            const adminDistributor = await this.db.prepare(
                "SELECT id FROM distributors WHERE role = 'admin' LIMIT 1"
            ).first<{ id: number }>()
            const defaultDistributorId = adminDistributor?.id || null

            // Enqueue new orders
            for (const order of newOrders) {
                await this.queue.send({
                    platform: order.platform,
                    payload: {
                        order_id: order.platform_order_id,
                        items: order.items,
                        total: order.total,
                        distributor_id: defaultDistributorId,
                    },
                    receivedAt: new Date().toISOString(),
                })
            }

            // Update sync log
            await this.db.prepare(
                `UPDATE platform_sync_logs SET status = 'COMPLETED', orders_fetched = ?, orders_queued = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(orders.length, newOrders.length, logId).run()

            return {
                logId,
                ordersFetched: orders.length,
                ordersQueued: newOrders.length,
            }
        } catch (e: any) {
            await this.db.prepare(
                `UPDATE platform_sync_logs SET status = 'FAILED', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(e.message, logId).run()
            throw e
        }
    }
}
