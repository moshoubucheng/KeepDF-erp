import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { CustomerSegmentService } from '../services/customer-segment.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'

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

async function addTestCustomers(db: D1Database) {
    await db.prepare("INSERT INTO customers (name, email, platform, distributor_id) VALUES ('Alice', 'a@test.com', 'TIKTOK', 1)").run()
    await db.prepare("INSERT INTO customers (name, email, platform, distributor_id) VALUES ('Bob', 'b@test.com', 'TEMU', 1)").run()
    await db.prepare("INSERT INTO customers (name, email, platform, distributor_id) VALUES ('Charlie', 'c@test.com', 'RAKUTEN', 1)").run()
}

describe('Customer Segment Service', () => {
    beforeEach(async () => { await setupDB(env.DB); await addTestCustomers(env.DB) })

    it('calculates RFM for all customers', async () => {
        const service = new CustomerSegmentService(env.DB)
        const rfm = await service.calculateRFM(1, 'admin')
        expect(rfm.length).toBeGreaterThanOrEqual(3)
        rfm.forEach(c => {
            expect(c.r_score).toBeGreaterThanOrEqual(1)
            expect(c.r_score).toBeLessThanOrEqual(5)
            expect(c.rfm_score).toMatch(/^\d{3}$/)
        })
    })

    it('gets RFM distribution', async () => {
        const service = new CustomerSegmentService(env.DB)
        const dist = await service.getRFMDistribution(1, 'admin')
        expect(dist.total).toBeGreaterThanOrEqual(3)
        expect(dist.segments).toBeTruthy()
    })

    it('creates a segment', async () => {
        const service = new CustomerSegmentService(env.DB)
        const seg = await service.createSegment({
            name: 'VIP', rules: { min_orders: 5 }, color: '#10b981',
        }, 1)
        expect(seg.name).toBe('VIP')
        expect(seg.color).toBe('#10b981')
    })

    it('lists segments', async () => {
        const service = new CustomerSegmentService(env.DB)
        await service.createSegment({ name: 'VIP', rules: {} }, 1)
        await service.createSegment({ name: 'At Risk', rules: {} }, 1)
        const segments = await service.listSegments(1, 'admin')
        expect(segments.length).toBe(2)
    })

    it('updates a segment', async () => {
        const service = new CustomerSegmentService(env.DB)
        const seg = await service.createSegment({ name: 'VIP', rules: {} }, 1)
        const updated = await service.updateSegment(seg.id, { name: 'Super VIP' }, 1, 'admin')
        expect(updated.name).toBe('Super VIP')
    })

    it('deletes a segment', async () => {
        const service = new CustomerSegmentService(env.DB)
        const seg = await service.createSegment({ name: 'Temp', rules: {} }, 1)
        const deleted = await service.deleteSegment(seg.id, 1, 'admin')
        expect(deleted).toBe(true)
    })

    it('gets customers in segment', async () => {
        const service = new CustomerSegmentService(env.DB)
        const seg = await service.createSegment({ name: 'All', rules: {} }, 1)
        const result = await service.getSegmentCustomers(seg.id, 1, 'admin')
        expect(result.total).toBeGreaterThanOrEqual(0)
    })

    it('filters by platform in rules', async () => {
        const service = new CustomerSegmentService(env.DB)
        const seg = await service.createSegment({ name: 'TikTok Only', rules: { platform: 'TIKTOK' } }, 1)
        const result = await service.getSegmentCustomers(seg.id, 1, 'admin')
        if (result.customers.length > 0) {
            result.customers.forEach((c: any) => expect(c.platform).toBe('TIKTOK'))
        }
    })

    it('refreshes segment counts', async () => {
        const service = new CustomerSegmentService(env.DB)
        await service.createSegment({ name: 'All', rules: {} }, 1)
        await service.refreshSegmentCounts(1, 'admin')
        const segments = await service.listSegments(1, 'admin')
        expect(segments[0]).toHaveProperty('customer_count')
    })

    it('data isolation for distributors', async () => {
        const service = new CustomerSegmentService(env.DB)
        await service.createSegment({ name: 'Admin Seg', rules: {} }, 1)
        const segsForDist2 = await service.listSegments(2, 'distributor')
        expect(segsForDist2.length).toBe(0)
    })
})
