/**
 * CouponService - Coupon management, validation, and application
 */
import type { Coupon, CouponUsage } from '../db/types'

const VALID_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const

function generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'KDF-'
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
}

export class CouponService {
    constructor(private db: D1Database) {}

    async list(filters?: { platform?: string; is_active?: number; limit?: number; offset?: number }): Promise<{ coupons: Coupon[]; total: number }> {
        const limit = Math.min(Math.max(1, filters?.limit || 50), 200)
        const offset = Math.max(0, filters?.offset || 0)

        let where = '1=1'
        const binds: (string | number)[] = []

        if (filters?.platform) {
            where += ' AND (platform = ? OR platform = ?)'
            binds.push(filters.platform.toUpperCase(), 'ALL')
        }
        if (filters?.is_active !== undefined) {
            where += ' AND is_active = ?'
            binds.push(filters.is_active)
        }

        const countBinds = [...binds]

        const sql = `SELECT * FROM coupons WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        binds.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM coupons WHERE ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...binds).all<Coupon>(),
            this.db.prepare(countSql).bind(...countBinds).first<{ total: number }>(),
        ])

        return { coupons: results, total: countResult?.total || 0 }
    }

    async getById(id: number): Promise<Coupon | null> {
        return this.db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first<Coupon>()
    }

    async getByCode(code: string): Promise<Coupon | null> {
        return this.db.prepare('SELECT * FROM coupons WHERE code = ?').bind(code.toUpperCase()).first<Coupon>()
    }

    async create(data: {
        code?: string
        name: string
        type: string
        value: number
        currency?: string
        min_order_amount?: number
        max_discount?: number
        usage_limit?: number
        per_user_limit?: number
        platform?: string
        valid_from: string
        valid_to: string
    }, createdBy: number): Promise<Coupon> {
        if (!VALID_TYPES.includes(data.type as typeof VALID_TYPES[number])) {
            throw new Error(`Invalid coupon type. Must be one of: ${VALID_TYPES.join(', ')}`)
        }
        if (data.value <= 0) throw new Error('Coupon value must be positive')

        const code = data.code ? data.code.toUpperCase() : generateCode()

        // Check uniqueness
        const existing = await this.getByCode(code)
        if (existing) throw new Error(`Coupon code already exists: ${code}`)

        const { meta } = await this.db.prepare(
            `INSERT INTO coupons (code, name, type, value, currency, min_order_amount, max_discount, usage_limit, per_user_limit, platform, valid_from, valid_to, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            code, data.name, data.type, data.value,
            data.currency || 'JPY',
            data.min_order_amount || 0,
            data.max_discount || null,
            data.usage_limit || 0,
            data.per_user_limit || 1,
            data.platform || 'ALL',
            data.valid_from, data.valid_to,
            createdBy
        ).run()

        return this.getById(meta.last_row_id) as Promise<Coupon>
    }

    async update(id: number, data: Partial<{
        name: string
        value: number
        min_order_amount: number
        max_discount: number | null
        usage_limit: number
        per_user_limit: number
        platform: string
        valid_from: string
        valid_to: string
        is_active: number
    }>): Promise<Coupon | null> {
        const existing = await this.getById(id)
        if (!existing) return null

        const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
        const binds: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); binds.push(data.name) }
        if (data.value !== undefined) { fields.push('value = ?'); binds.push(data.value) }
        if (data.min_order_amount !== undefined) { fields.push('min_order_amount = ?'); binds.push(data.min_order_amount) }
        if (data.max_discount !== undefined) { fields.push('max_discount = ?'); binds.push(data.max_discount) }
        if (data.usage_limit !== undefined) { fields.push('usage_limit = ?'); binds.push(data.usage_limit) }
        if (data.per_user_limit !== undefined) { fields.push('per_user_limit = ?'); binds.push(data.per_user_limit) }
        if (data.platform !== undefined) { fields.push('platform = ?'); binds.push(data.platform) }
        if (data.valid_from !== undefined) { fields.push('valid_from = ?'); binds.push(data.valid_from) }
        if (data.valid_to !== undefined) { fields.push('valid_to = ?'); binds.push(data.valid_to) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); binds.push(data.is_active) }

        binds.push(id)
        await this.db.prepare(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()

        return this.getById(id)
    }

    async deactivate(id: number): Promise<Coupon | null> {
        return this.update(id, { is_active: 0 })
    }

    async validate(code: string, params: {
        distributorId: number
        orderTotal: number
        platform?: string
        currency?: string
    }): Promise<{ valid: boolean; error?: string; coupon?: Coupon; discountAmount?: number }> {
        const coupon = await this.getByCode(code)
        if (!coupon) return { valid: false, error: 'Coupon not found' }
        if (!coupon.is_active) return { valid: false, error: 'Coupon is not active' }

        const now = new Date().toISOString()
        if (now < coupon.valid_from) return { valid: false, error: 'Coupon is not yet valid' }
        if (now > coupon.valid_to) return { valid: false, error: 'Coupon has expired' }

        // Platform check
        if (coupon.platform !== 'ALL' && params.platform && coupon.platform !== params.platform.toUpperCase()) {
            return { valid: false, error: `Coupon not valid for platform: ${params.platform}` }
        }

        // Usage limit (0 = unlimited)
        if (coupon.usage_limit > 0 && coupon.usage_count >= coupon.usage_limit) {
            return { valid: false, error: 'Coupon usage limit reached' }
        }

        // Per-user limit
        if (coupon.per_user_limit > 0) {
            const userUsage = await this.db.prepare(
                'SELECT COUNT(*) as cnt FROM coupon_usage WHERE coupon_id = ? AND distributor_id = ?'
            ).bind(coupon.id, params.distributorId).first<{ cnt: number }>()
            if (userUsage && userUsage.cnt >= coupon.per_user_limit) {
                return { valid: false, error: 'Per-user usage limit reached' }
            }
        }

        // Min order amount
        if (params.orderTotal < coupon.min_order_amount) {
            return { valid: false, error: `Minimum order amount: ${coupon.min_order_amount}` }
        }

        // Calculate discount
        let discountAmount = 0
        if (coupon.type === 'PERCENTAGE') {
            discountAmount = Math.floor(params.orderTotal * coupon.value / 100)
            if (coupon.max_discount && discountAmount > coupon.max_discount) {
                discountAmount = coupon.max_discount
            }
        } else if (coupon.type === 'FIXED_AMOUNT') {
            discountAmount = Math.min(coupon.value, params.orderTotal)
        } else if (coupon.type === 'FREE_SHIPPING') {
            discountAmount = 0 // shipping cost handled separately
        }

        return { valid: true, coupon, discountAmount }
    }

    async apply(couponId: number, orderId: number, distributorId: number, discountAmount: number, discountAmountJpy: number): Promise<CouponUsage> {
        // Re-validate usage limits atomically before applying (prevents race condition)
        const coupon = await this.db.prepare('SELECT * FROM coupons WHERE id = ?')
            .bind(couponId).first<Coupon>()
        if (!coupon) throw new Error('Coupon not found')

        if (coupon.usage_limit > 0 && coupon.usage_count >= coupon.usage_limit) {
            throw new Error('Coupon usage limit reached')
        }

        // Atomic: increment usage_count only if still within limit
        const updateResult = await this.db.prepare(
            `UPDATE coupons SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND (usage_limit = 0 OR usage_count < usage_limit)`
        ).bind(couponId).run()

        if (!updateResult.meta.changes) {
            throw new Error('Coupon usage limit reached (concurrent)')
        }

        // Insert usage record
        const { meta } = await this.db.prepare(
            `INSERT INTO coupon_usage (coupon_id, order_id, distributor_id, discount_amount, discount_amount_jpy)
             VALUES (?, ?, ?, ?, ?)`
        ).bind(couponId, orderId, distributorId, discountAmount, discountAmountJpy).run()

        // Post-insert per_user_limit check (atomic: rollback if exceeded)
        if (coupon.per_user_limit > 0) {
            const userUsage = await this.db.prepare(
                'SELECT COUNT(*) as cnt FROM coupon_usage WHERE coupon_id = ? AND distributor_id = ?'
            ).bind(couponId, distributorId).first<{ cnt: number }>()
            if (userUsage && userUsage.cnt > coupon.per_user_limit) {
                // Rollback: delete usage record and decrement usage_count
                await this.db.prepare('DELETE FROM coupon_usage WHERE id = ?').bind(meta.last_row_id).run()
                await this.db.prepare(
                    'UPDATE coupons SET usage_count = usage_count - 1 WHERE id = ? AND usage_count > 0'
                ).bind(couponId).run()
                throw new Error('Per-user usage limit reached')
            }
        }

        return this.db.prepare('SELECT * FROM coupon_usage WHERE id = ?')
            .bind(meta.last_row_id).first<CouponUsage>() as Promise<CouponUsage>
    }

    async getAvailable(distributorId: number, platform?: string): Promise<Coupon[]> {
        const now = new Date().toISOString()
        let sql = `SELECT * FROM coupons WHERE is_active = 1 AND valid_from <= ? AND valid_to >= ?
                   AND (usage_limit = 0 OR usage_count < usage_limit)`
        const binds: (string | number)[] = [now, now]

        if (platform) {
            sql += ' AND (platform = ? OR platform = ?)'
            binds.push(platform.toUpperCase(), 'ALL')
        }

        sql += ' ORDER BY valid_to ASC'

        const { results } = await this.db.prepare(sql).bind(...binds).all<Coupon>()

        // Filter by per-user limit
        const available: Coupon[] = []
        for (const coupon of results) {
            if (coupon.per_user_limit > 0) {
                const usage = await this.db.prepare(
                    'SELECT COUNT(*) as cnt FROM coupon_usage WHERE coupon_id = ? AND distributor_id = ?'
                ).bind(coupon.id, distributorId).first<{ cnt: number }>()
                if (usage && usage.cnt >= coupon.per_user_limit) continue
            }
            available.push(coupon)
        }

        return available
    }

    async getUsage(couponId: number): Promise<{ usage: CouponUsage[]; total: number }> {
        const { results } = await this.db.prepare(
            'SELECT * FROM coupon_usage WHERE coupon_id = ? ORDER BY used_at DESC'
        ).bind(couponId).all<CouponUsage>()
        return { usage: results, total: results.length }
    }
}
