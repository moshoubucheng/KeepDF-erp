import type { Commission, CommissionSettlement, Order } from '../db/types'

export class CommissionService {
    constructor(private db: D1Database) {}

    /** 获取佣金费率表 */
    async getRates(filters?: { platform?: string; sku?: string }): Promise<Commission[]> {
        let sql = 'SELECT * FROM commissions WHERE 1=1'
        const params: any[] = []

        if (filters?.platform) {
            sql += ' AND platform = ?'
            params.push(filters.platform.toUpperCase())
        }
        if (filters?.sku) {
            sql += ' AND sku = ?'
            params.push(filters.sku)
        }

        sql += ' ORDER BY platform, sku'
        const { results } = await this.db.prepare(sql).bind(...params).all<Commission>()
        return results
    }

    /** 计算单个订单的佣金 */
    async calculateOrderCommission(orderId: number, platform: string): Promise<{
        items: Array<{
            sku: string
            qty: number
            unit_price: number
            commission_rate: number
            commission_amount: number
        }>
        totalCommission: number
    }> {
        const { results } = await this.db.prepare(`
            SELECT
                oi.sku, oi.qty, oi.unit_price,
                COALESCE(c.rate, 0) as commission_rate
            FROM order_items oi
            LEFT JOIN commissions c ON c.sku = oi.sku AND c.platform = ?
            WHERE oi.order_id = ?
        `).bind(platform, orderId).all()

        const items = results.map((r: any) => ({
            sku: r.sku as string,
            qty: r.qty as number,
            unit_price: r.unit_price as number,
            commission_rate: r.commission_rate as number,
            commission_amount: Math.floor((r.unit_price as number) * (r.qty as number) * (r.commission_rate as number)),
        }))

        const totalCommission = items.reduce((sum, item) => sum + item.commission_amount, 0)
        return { items, totalCommission }
    }

    /** 批量结算佣金 */
    async settleCommissions(distributorId: number, orderIds: number[]): Promise<{
        settled: number
        failed: number
        totalAmount: number
        details: Array<{ orderId: number; status: 'SETTLED' | 'FAILED'; amount: number; error?: string }>
        newBalance: number
    }> {
        const placeholders = orderIds.map(() => '?').join(',')
        const { results: orders } = await this.db.prepare(
            `SELECT * FROM orders WHERE id IN (${placeholders}) AND distributor_id = ?`
        ).bind(...orderIds, distributorId).all<Order>()

        if (orders.length !== orderIds.length) {
            throw new Error('Some orders do not belong to this distributor')
        }

        let totalAmount = 0
        const details: Array<{ orderId: number; status: 'SETTLED' | 'FAILED'; amount: number; error?: string }> = []
        const settlementStmts: D1PreparedStatement[] = []

        for (const order of orders) {
            const { items, totalCommission } = await this.calculateOrderCommission(order.id, order.platform)

            const existing = await this.db.prepare(
                'SELECT id FROM commission_settlements WHERE order_id = ? AND distributor_id = ? AND status = ?'
            ).bind(order.id, distributorId, 'SETTLED').first()

            if (existing) {
                details.push({ orderId: order.id, status: 'FAILED', amount: 0, error: 'Already settled' })
                continue
            }

            totalAmount += totalCommission

            for (const item of items) {
                if (item.commission_amount > 0) {
                    settlementStmts.push(
                        this.db.prepare(`
                            INSERT INTO commission_settlements
                            (distributor_id, order_id, sku, platform, qty, unit_price, commission_rate, commission_amount, status, settled_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', datetime('now'))
                        `).bind(
                            distributorId, order.id, item.sku, order.platform,
                            item.qty, item.unit_price, item.commission_rate, item.commission_amount
                        )
                    )
                }
            }

            details.push({ orderId: order.id, status: 'SETTLED', amount: totalCommission })
        }

        const distributor = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()

        if (!distributor || distributor.balance < totalAmount) {
            throw new Error('Insufficient balance')
        }

        const newBalance = distributor.balance - totalAmount

        const batch = [
            this.db.prepare('UPDATE distributors SET balance = ? WHERE id = ?')
                .bind(newBalance, distributorId),
            this.db.prepare(`
                INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
                VALUES (?, 'DEDUCT', ?, ?, ?)
            `).bind(distributorId, totalAmount, orderIds.join(','), newBalance),
            ...settlementStmts,
        ]

        await this.db.batch(batch)

        return {
            settled: details.filter(d => d.status === 'SETTLED').length,
            failed: details.filter(d => d.status === 'FAILED').length,
            totalAmount,
            details,
            newBalance,
        }
    }

    /** 结算历史 */
    async getHistory(distributorId: number, filters?: {
        status?: string
        limit?: number
        offset?: number
    }): Promise<{ settlements: CommissionSettlement[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let sql = 'SELECT * FROM commission_settlements WHERE distributor_id = ?'
        let countSql = 'SELECT COUNT(*) as total FROM commission_settlements WHERE distributor_id = ?'
        const params: any[] = [distributorId]
        const countParams: any[] = [distributorId]

        if (filters?.status) {
            sql += ' AND status = ?'
            countSql += ' AND status = ?'
            params.push(filters.status.toUpperCase())
            countParams.push(filters.status.toUpperCase())
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.push(limit, offset)

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all<CommissionSettlement>(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { settlements: results, total: countResult?.total || 0 }
    }
}
