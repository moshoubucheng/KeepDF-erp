const VALID_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'THRESHOLD'] as const

export class PromotionService {
    constructor(private db: D1Database) {}

    async list(distributorId: number, role: string, filters?: {
        status?: string
        limit?: number
        offset?: number
    }): Promise<{ promotions: any[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (role !== 'admin') {
            where += ' AND distributor_id = ?'
            params.push(distributorId)
        }

        const now = new Date().toISOString()
        if (filters?.status === 'active') {
            where += ' AND is_active = 1 AND start_date <= ? AND end_date >= ?'
            params.push(now, now)
        } else if (filters?.status === 'expired') {
            where += ' AND end_date < ?'
            params.push(now)
        } else if (filters?.status === 'upcoming') {
            where += ' AND start_date > ?'
            params.push(now)
        }

        const countParams = [...params]
        const sql = `SELECT * FROM promotions ${where} ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)
        const countSql = `SELECT COUNT(*) as total FROM promotions ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { promotions: results, total: countResult?.total || 0 }
    }

    async getById(id: number): Promise<any | null> {
        return this.db.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first()
    }

    async create(data: {
        name: string
        type: string
        discount_value: number
        min_order_amount?: number
        min_quantity?: number
        buy_quantity?: number
        get_quantity?: number
        applicable_skus?: string[]
        applicable_platforms?: string[]
        start_date: string
        end_date: string
        max_uses?: number
        priority?: number
    }, distributorId: number): Promise<any> {
        if (!data.name || !data.type) throw new Error('name and type are required')
        if (!VALID_TYPES.includes(data.type as any)) {
            throw new Error(`Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`)
        }
        if (data.discount_value <= 0) throw new Error('discount_value must be positive')
        if (!data.start_date || !data.end_date) throw new Error('start_date and end_date are required')

        const { meta } = await this.db.prepare(
            `INSERT INTO promotions (name, type, discount_value, min_order_amount, min_quantity,
             buy_quantity, get_quantity, applicable_skus, applicable_platforms,
             start_date, end_date, max_uses, priority, distributor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.name, data.type, data.discount_value,
            data.min_order_amount || 0, data.min_quantity || 0,
            data.buy_quantity || null, data.get_quantity || null,
            JSON.stringify(data.applicable_skus || []),
            JSON.stringify(data.applicable_platforms || []),
            data.start_date, data.end_date,
            data.max_uses || 0, data.priority || 0,
            distributorId,
        ).run()

        return this.getById(meta.last_row_id)
    }

    async update(id: number, data: Partial<{
        name: string; discount_value: number; min_order_amount: number
        min_quantity: number; applicable_skus: string[]
        applicable_platforms: string[]; start_date: string; end_date: string
        max_uses: number; priority: number; is_active: number
    }>): Promise<any | null> {
        const existing = await this.getById(id)
        if (!existing) return null

        const fields: string[] = []
        const binds: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); binds.push(data.name) }
        if (data.discount_value !== undefined) { fields.push('discount_value = ?'); binds.push(data.discount_value) }
        if (data.min_order_amount !== undefined) { fields.push('min_order_amount = ?'); binds.push(data.min_order_amount) }
        if (data.min_quantity !== undefined) { fields.push('min_quantity = ?'); binds.push(data.min_quantity) }
        if (data.applicable_skus !== undefined) { fields.push('applicable_skus = ?'); binds.push(JSON.stringify(data.applicable_skus)) }
        if (data.applicable_platforms !== undefined) { fields.push('applicable_platforms = ?'); binds.push(JSON.stringify(data.applicable_platforms)) }
        if (data.start_date !== undefined) { fields.push('start_date = ?'); binds.push(data.start_date) }
        if (data.end_date !== undefined) { fields.push('end_date = ?'); binds.push(data.end_date) }
        if (data.max_uses !== undefined) { fields.push('max_uses = ?'); binds.push(data.max_uses) }
        if (data.priority !== undefined) { fields.push('priority = ?'); binds.push(data.priority) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); binds.push(data.is_active) }

        if (fields.length === 0) return existing
        binds.push(id)

        await this.db.prepare(`UPDATE promotions SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()
        return this.getById(id)
    }

    async delete(id: number): Promise<boolean> {
        const promo = await this.getById(id)
        if (!promo) return false

        const now = new Date().toISOString()
        if (promo.start_date <= now && promo.end_date >= now && promo.is_active) {
            throw new Error('Cannot delete an active promotion')
        }

        const { meta } = await this.db.prepare('DELETE FROM promotions WHERE id = ?').bind(id).run()
        return (meta.changes ?? 0) > 0
    }

    async getApplicable(orderId: number, distributorId: number): Promise<any[]> {
        const order = await this.db.prepare(
            `SELECT o.*, GROUP_CONCAT(oi.sku) as skus
             FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.id = ? GROUP BY o.id`
        ).bind(orderId).first<any>()
        if (!order) return []

        const now = new Date().toISOString()
        const { results: promos } = await this.db.prepare(
            `SELECT * FROM promotions
             WHERE is_active = 1 AND start_date <= ? AND end_date >= ?
               AND (max_uses = 0 OR current_uses < max_uses)
               AND distributor_id = ?
             ORDER BY priority DESC`
        ).bind(now, now, distributorId).all<any>()

        return promos.filter(p => {
            // Platform filter
            const platforms = JSON.parse(p.applicable_platforms || '[]')
            if (platforms.length > 0 && !platforms.includes(order.platform)) return false

            // SKU filter
            const applicableSkus = JSON.parse(p.applicable_skus || '[]')
            if (applicableSkus.length > 0) {
                const orderSkus = (order.skus || '').split(',')
                if (!applicableSkus.some((s: string) => orderSkus.includes(s))) return false
            }

            // Min order amount
            if (p.min_order_amount > 0 && order.total_amount < p.min_order_amount) return false

            return true
        })
    }

    calculateDiscount(promotion: any, orderAmount: number, items?: any[]): number {
        switch (promotion.type) {
            case 'PERCENTAGE':
                return Math.floor(orderAmount * promotion.discount_value / 100)
            case 'FIXED_AMOUNT':
                return Math.min(promotion.discount_value, orderAmount)
            case 'THRESHOLD':
                return orderAmount >= promotion.min_order_amount
                    ? Math.floor(orderAmount * promotion.discount_value / 100)
                    : 0
            case 'BUY_X_GET_Y':
                if (!items || !promotion.buy_quantity || promotion.buy_quantity <= 0) return 0
                const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 0), 0)
                if (totalQty >= promotion.buy_quantity) {
                    const freeItems = Math.floor(totalQty / promotion.buy_quantity) * (promotion.get_quantity || 0)
                    const avgPrice = orderAmount / Math.max(totalQty, 1)
                    return Math.floor(freeItems * avgPrice)
                }
                return 0
            default:
                return 0
        }
    }

    async applyBest(orderId: number, distributorId: number): Promise<{ promotion: any; discount: number } | null> {
        const applicable = await this.getApplicable(orderId, distributorId)
        if (applicable.length === 0) return null

        const order = await this.db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<any>()
        if (!order) return null

        let bestPromo: any = null
        let bestDiscount = 0

        for (const promo of applicable) {
            const discount = this.calculateDiscount(promo, order.total_amount)
            if (discount > bestDiscount) {
                bestDiscount = discount
                bestPromo = promo
            }
        }

        if (bestPromo) {
            await this.db.prepare(
                'UPDATE promotions SET current_uses = current_uses + 1 WHERE id = ?'
            ).bind(bestPromo.id).run()

            await this.db.prepare(
                'UPDATE orders SET discount_amount = ? WHERE id = ?'
            ).bind(bestDiscount, orderId).run()
        }

        return bestPromo ? { promotion: bestPromo, discount: bestDiscount } : null
    }
}
