import { NotificationService } from './notification.service'

export class LowStockChecker {
    constructor(private db: D1Database) {}

    async check(threshold = 50): Promise<{ alertsSent: number; products: any[] }> {
        const { results } = await this.db.prepare(`
            SELECT p.sku, p.name_jp, wl.qty, wl.code
            FROM warehouse_locations wl
            JOIN products p ON p.sku = wl.sku
            WHERE wl.qty <= ?
            ORDER BY wl.qty ASC
        `).bind(threshold).all()

        if (results.length === 0) {
            return { alertsSent: 0, products: [] }
        }

        const notification = new NotificationService(this.db)
        const productLines = results.map((p: any) =>
            `${p.name_jp || p.sku} (${p.code}): ${p.qty}個`
        ).join('\n')

        await notification.send({
            type: 'WARNING',
            channel: 'LARK',
            message: `低在庫アラート (閾値: ${threshold})\n\n${productLines}`,
        })

        return { alertsSent: results.length, products: results as any[] }
    }
}
