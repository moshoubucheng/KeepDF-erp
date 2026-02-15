import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { CouponService } from '../services/coupon.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'coupon_usage', 'coupons', 'shipment_events', 'exchange_rates',
    'automation_logs', 'automation_rules',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
]

async function setupDB(db: D1Database) {
    for (const table of TABLE_NAMES) {
        await db.prepare(`DROP TABLE IF EXISTS ${table}`).run()
    }
    for (const stmt of schemaSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
    for (const stmt of seedSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

const futureDate = '2027-12-31T23:59:59Z'
const pastDate = '2024-01-01T00:00:00Z'
const now = new Date().toISOString()

async function createTestCoupon(db: D1Database, overrides: Record<string, any> = {}) {
    const service = new CouponService(db)
    return service.create({
        name: 'Test Coupon',
        type: 'PERCENTAGE',
        value: 10,
        valid_from: pastDate,
        valid_to: futureDate,
        ...overrides,
    }, 1)
}

describe('Coupon Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('create() with auto-generated code', async () => {
        const service = new CouponService(env.DB)
        const coupon = await service.create({
            name: 'Auto Code Coupon',
            type: 'PERCENTAGE',
            value: 10,
            valid_from: pastDate,
            valid_to: futureDate,
        }, 1)
        expect(coupon.code).toMatch(/^KDF-[A-Z0-9]{8}$/)
        expect(coupon.name).toBe('Auto Code Coupon')
    })

    it('create() with custom code', async () => {
        const coupon = await createTestCoupon(env.DB, { code: 'SUMMER2026' })
        expect(coupon.code).toBe('SUMMER2026')
    })

    it('validate() success', async () => {
        const coupon = await createTestCoupon(env.DB, { code: 'VALID10' })
        const service = new CouponService(env.DB)
        const result = await service.validate('VALID10', {
            distributorId: 2,
            orderTotal: 10000,
        })
        expect(result.valid).toBe(true)
        expect(result.discountAmount).toBe(1000) // 10% of 10000
    })

    it('validate() expired coupon', async () => {
        await createTestCoupon(env.DB, { code: 'EXPIRED', valid_from: '2024-01-01', valid_to: '2024-12-31' })
        const service = new CouponService(env.DB)
        const result = await service.validate('EXPIRED', { distributorId: 2, orderTotal: 10000 })
        expect(result.valid).toBe(false)
        expect(result.error).toContain('expired')
    })

    it('validate() usage_limit reached', async () => {
        const coupon = await createTestCoupon(env.DB, { code: 'LIMIT1', usage_limit: 1 })
        const service = new CouponService(env.DB)
        // Apply once
        await service.apply(coupon.id, 1, 1, 100, 100)
        // Try to validate again
        const result = await service.validate('LIMIT1', { distributorId: 2, orderTotal: 10000 })
        expect(result.valid).toBe(false)
        expect(result.error).toContain('usage limit')
    })

    it('validate() per_user_limit reached', async () => {
        const coupon = await createTestCoupon(env.DB, { code: 'PERUSER', per_user_limit: 1 })
        const service = new CouponService(env.DB)
        // Dist2 uses it
        await service.apply(coupon.id, 1, 2, 100, 100)
        // Dist2 tries again
        const result = await service.validate('PERUSER', { distributorId: 2, orderTotal: 10000 })
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Per-user')
    })

    it('validate() min_order_amount', async () => {
        await createTestCoupon(env.DB, { code: 'MINAMT', min_order_amount: 5000 })
        const service = new CouponService(env.DB)
        const result = await service.validate('MINAMT', { distributorId: 2, orderTotal: 3000 })
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Minimum order')
    })

    it('validate() platform mismatch', async () => {
        await createTestCoupon(env.DB, { code: 'TIKONLY', platform: 'TIKTOK' })
        const service = new CouponService(env.DB)
        const result = await service.validate('TIKONLY', { distributorId: 2, orderTotal: 10000, platform: 'TEMU' })
        expect(result.valid).toBe(false)
        expect(result.error).toContain('not valid for platform')
    })

    it('apply() increments usage_count', async () => {
        const coupon = await createTestCoupon(env.DB, { code: 'APPLY1' })
        const service = new CouponService(env.DB)
        expect(coupon.usage_count).toBe(0)
        await service.apply(coupon.id, 1, 2, 500, 500)
        const updated = await service.getById(coupon.id)
        expect(updated!.usage_count).toBe(1)
    })

    it('PERCENTAGE max_discount cap', async () => {
        await createTestCoupon(env.DB, { code: 'CAPPED', value: 20, max_discount: 1000 })
        const service = new CouponService(env.DB)
        const result = await service.validate('CAPPED', { distributorId: 2, orderTotal: 50000 })
        expect(result.valid).toBe(true)
        // 20% of 50000 = 10000, but max_discount = 1000
        expect(result.discountAmount).toBe(1000)
    })
})
