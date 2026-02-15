import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { PromotionService } from '../services/promotion.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TABLE_NAMES = [
    'dashboard_layouts', 'webhook_logs', 'webhook_endpoints', 'audit_snapshots',
    'approval_requests', 'approval_workflows', 'promotions', 'customer_segments',
    'stocktake_items', 'stocktakes', 'shipping_fees', 'shipping_fee_templates',
    'coupon_usage', 'coupons', 'shipment_events', 'exchange_rates',
    'automation_logs', 'automation_rules',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
]

async function setupDB(db: D1Database) {
    for (const table of TABLE_NAMES) { await db.prepare(`DROP TABLE IF EXISTS ${table}`).run() }
    for (const stmt of schemaSQL.split(';')) { const t = stmt.trim(); if (t) await db.prepare(t).run() }
    for (const stmt of seedSQL.split(';')) { const t = stmt.trim(); if (t) await db.prepare(t).run() }
}

const futureDate = '2027-12-31T23:59:59Z'
const pastDate = '2024-01-01T00:00:00Z'

describe('Promotion Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates a PERCENTAGE promotion', async () => {
        const service = new PromotionService(env.DB)
        const promo = await service.create({
            name: 'Summer Sale', type: 'PERCENTAGE', discount_value: 15,
            start_date: pastDate, end_date: futureDate,
        }, 1)
        expect(promo.name).toBe('Summer Sale')
        expect(promo.type).toBe('PERCENTAGE')
        expect(promo.discount_value).toBe(15)
    })

    it('creates a FIXED_AMOUNT promotion', async () => {
        const service = new PromotionService(env.DB)
        const promo = await service.create({
            name: '500 Off', type: 'FIXED_AMOUNT', discount_value: 500,
            start_date: pastDate, end_date: futureDate,
        }, 1)
        expect(promo.type).toBe('FIXED_AMOUNT')
    })

    it('lists promotions with status filter', async () => {
        const service = new PromotionService(env.DB)
        await service.create({ name: 'Active', type: 'PERCENTAGE', discount_value: 10, start_date: pastDate, end_date: futureDate }, 1)
        await service.create({ name: 'Expired', type: 'PERCENTAGE', discount_value: 10, start_date: '2023-01-01', end_date: '2023-12-31' }, 1)
        const { promotions: active } = await service.list(1, 'admin', { status: 'active' })
        expect(active.length).toBe(1)
        expect(active[0].name).toBe('Active')
    })

    it('updates a promotion', async () => {
        const service = new PromotionService(env.DB)
        const promo = await service.create({ name: 'P', type: 'PERCENTAGE', discount_value: 10, start_date: pastDate, end_date: futureDate }, 1)
        const updated = await service.update(promo.id, { discount_value: 20 })
        expect(updated.discount_value).toBe(20)
    })

    it('rejects deleting active promotion', async () => {
        const service = new PromotionService(env.DB)
        const promo = await service.create({ name: 'P', type: 'PERCENTAGE', discount_value: 10, start_date: pastDate, end_date: futureDate }, 1)
        await expect(service.delete(promo.id)).rejects.toThrow('active')
    })

    it('deletes expired promotion', async () => {
        const service = new PromotionService(env.DB)
        const promo = await service.create({ name: 'P', type: 'PERCENTAGE', discount_value: 10, start_date: '2023-01-01', end_date: '2023-12-31' }, 1)
        const deleted = await service.delete(promo.id)
        expect(deleted).toBe(true)
    })

    it('calculates PERCENTAGE discount', () => {
        const service = new PromotionService(env.DB)
        const discount = service.calculateDiscount({ type: 'PERCENTAGE', discount_value: 10 }, 10000)
        expect(discount).toBe(1000)
    })

    it('calculates FIXED_AMOUNT discount', () => {
        const service = new PromotionService(env.DB)
        const discount = service.calculateDiscount({ type: 'FIXED_AMOUNT', discount_value: 500 }, 10000)
        expect(discount).toBe(500)
    })

    it('calculates FIXED_AMOUNT discount capped at order amount', () => {
        const service = new PromotionService(env.DB)
        const discount = service.calculateDiscount({ type: 'FIXED_AMOUNT', discount_value: 500 }, 300)
        expect(discount).toBe(300)
    })

    it('rejects invalid promotion type', async () => {
        const service = new PromotionService(env.DB)
        await expect(service.create({ name: 'P', type: 'INVALID', discount_value: 10, start_date: pastDate, end_date: futureDate }, 1))
            .rejects.toThrow('Invalid type')
    })
})
