import type { Commission, CommissionSettlement, Order } from '../db/types'
import { decodeCursor, buildCursorWhere, encodeCursor } from '../utils/cursor'

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

        // Batch pre-fetch: which orders are already settled
        const settledRes = await this.db.prepare(
            `SELECT DISTINCT order_id FROM commission_settlements WHERE order_id IN (${placeholders}) AND distributor_id = ? AND status = 'SETTLED'`
        ).bind(...orderIds, distributorId).all<{ order_id: number }>()
        const settledSet = new Set(settledRes.results.map(r => r.order_id))

        for (const order of orders) {
            const { items, totalCommission } = await this.calculateOrderCommission(order.id, order.platform)

            if (settledSet.has(order.id)) {
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

        // Atomic balance deduction — prevents negative balance from concurrent requests
        const updateResult = await this.db.prepare(
            'UPDATE distributors SET balance = balance - ? WHERE id = ? AND balance >= ?'
        ).bind(totalAmount, distributorId, totalAmount).run()

        if (!updateResult.meta.changes) {
            throw new Error('Insufficient balance')
        }

        // Read new balance for snapshot
        const distributor = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()
        const newBalance = distributor?.balance ?? 0

        const batch = [
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

    /** Auto-settle commissions for a delivered order (fire-and-forget) */
    async autoSettleOrder(orderId: number): Promise<void> {
        try {
            // 1. Get order info
            const order = await this.db.prepare('SELECT * FROM orders WHERE id = ?')
                .bind(orderId).first<Order>()
            if (!order) return

            // 2. Check if already settled
            const existing = await this.db.prepare(
                "SELECT id FROM commission_settlements WHERE order_id = ? AND status = 'SETTLED'"
            ).bind(orderId).first()
            if (existing) return

            // 3. Calculate commissions
            const { items, totalCommission } = await this.calculateOrderCommission(orderId, order.platform)
            if (totalCommission === 0) return

            // 4. Create settlement records
            const stmts: D1PreparedStatement[] = []
            for (const item of items) {
                if (item.commission_amount > 0) {
                    stmts.push(
                        this.db.prepare(`
                            INSERT INTO commission_settlements
                            (distributor_id, order_id, sku, platform, qty, unit_price, commission_rate, commission_amount, status, settled_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', datetime('now'))
                        `).bind(
                            order.distributor_id, orderId, item.sku, order.platform,
                            item.qty, item.unit_price, item.commission_rate, item.commission_amount
                        )
                    )
                }
            }

            if (stmts.length > 0) {
                await this.db.batch(stmts)
            }
        } catch (e) {
            console.error('Auto-settle failed:', e)
        }
    }

    /** 结算历史 */
    async getHistory(distributorId: number, filters?: {
        status?: string
        limit?: number
        offset?: number
        cursor?: string
    }): Promise<{ settlements: CommissionSettlement[]; total: number; nextCursor?: string; hasMore?: boolean }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE distributor_id = ?'
        const baseParams: any[] = [distributorId]

        if (filters?.status) {
            where += ' AND status = ?'
            baseParams.push(filters.status.toUpperCase())
        }

        const countSql = `SELECT COUNT(*) as total FROM commission_settlements ${where}`
        const countResult = await this.db.prepare(countSql).bind(...baseParams).first<{ total: number }>()
        const total = countResult?.total || 0

        // Cursor-based pagination
        if (filters?.cursor) {
            const decoded = decodeCursor(filters.cursor)
            if (decoded) {
                const { clause, binds } = buildCursorWhere(decoded)
                const cursorWhere = `${where} AND ${clause}`
                const sql = `SELECT * FROM commission_settlements ${cursorWhere} ORDER BY created_at DESC, id DESC LIMIT ?`
                const { results } = await this.db.prepare(sql).bind(...baseParams, ...binds, limit + 1).all<CommissionSettlement>()

                const hasMore = results.length > limit
                const page = hasMore ? results.slice(0, limit) : results
                const nextCursor = hasMore && page.length > 0
                    ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
                    : undefined

                return { settlements: page, total, nextCursor, hasMore }
            }
        }

        // Offset-based fallback
        const sql = `SELECT * FROM commission_settlements ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        const { results } = await this.db.prepare(sql).bind(...baseParams, limit, offset).all<CommissionSettlement>()

        return { settlements: results, total }
    }
}
