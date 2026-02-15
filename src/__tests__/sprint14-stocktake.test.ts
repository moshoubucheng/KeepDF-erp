import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { StocktakeService } from '../services/stocktake.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'
const TOKEN_2 = 'tok_dev_def456'

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

describe('Stocktake Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates stocktake with auto-generated code', async () => {
        const service = new StocktakeService(env.DB)
        const result = await service.create(1)
        expect(result.stocktake.code).toMatch(/^ST-\d{8}-\d{3}$/)
        expect(result.stocktake.status).toBe('DRAFT')
    })

    it('auto-populates items from warehouse_locations', async () => {
        const service = new StocktakeService(env.DB)
        const result = await service.create(1)
        expect(result.items.length).toBeGreaterThan(0)
    })

    it('lists stocktakes', async () => {
        const service = new StocktakeService(env.DB)
        await service.create(1)
        await service.create(1)
        const { stocktakes, total } = await service.list()
        expect(total).toBe(2)
    })

    it('starts a stocktake (DRAFT → IN_PROGRESS)', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake } = await service.create(1)
        const result = await service.start(stocktake.id, 1)
        expect(result.stocktake.status).toBe('IN_PROGRESS')
    })

    it('counts items in IN_PROGRESS stocktake', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake, items } = await service.create(1)
        await service.start(stocktake.id, 1)
        if (items.length > 0) {
            const item = items[0] as any
            const counted = await service.countItem(stocktake.id, item.sku, item.location_code, 99)
            expect(counted.actual_qty).toBe(99)
        }
    })

    it('rejects counting in DRAFT status', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake } = await service.create(1)
        await expect(service.countItem(stocktake.id, 'SKU-001', 'A-1-1', 10))
            .rejects.toThrow('IN_PROGRESS')
    })

    it('completes stocktake and adjusts inventory', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake, items } = await service.create(1)
        await service.start(stocktake.id, 1)
        if (items.length > 0) {
            const item = items[0] as any
            await service.countItem(stocktake.id, item.sku, item.location_code, 999)
            const result = await service.complete(stocktake.id, 1)
            expect(result.stocktake.status).toBe('COMPLETED')
            // Check warehouse_locations updated
            const wl = await env.DB.prepare('SELECT qty FROM warehouse_locations WHERE sku = ? AND code = ?')
                .bind(item.sku, item.location_code).first<{ qty: number }>()
            expect(wl?.qty).toBe(999)
        }
    })

    it('cancels a stocktake', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake } = await service.create(1)
        const result = await service.cancel(stocktake.id, 1)
        expect(result.stocktake.status).toBe('CANCELLED')
    })

    it('generates variance report', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake, items } = await service.create(1)
        await service.start(stocktake.id, 1)
        if (items.length > 0) {
            const item = items[0] as any
            await service.countItem(stocktake.id, item.sku, item.location_code, item.expected_qty + 5)
        }
        const report = await service.getVarianceReport(stocktake.id)
        expect(report.stocktake).toBeTruthy()
        expect(report.summary).toBeTruthy()
    })

    it('rejects starting a COMPLETED stocktake', async () => {
        const service = new StocktakeService(env.DB)
        const { stocktake } = await service.create(1)
        await service.start(stocktake.id, 1)
        await service.complete(stocktake.id, 1)
        await expect(service.start(stocktake.id, 1)).rejects.toThrow()
    })
})
