import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { PricingService } from '../services/pricing.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin
const TOKEN_2 = 'tok_dev_def456' // distributor

const TABLE_NAMES = [
    'inventory_forecasts', 'message_triggers', 'customer_messages', 'message_templates',
    'price_history', 'price_rules', 'purchase_order_items', 'purchase_orders', 'suppliers',
    'return_items', 'returns',
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

describe('Pricing Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates a price rule', async () => {
        const service = new PricingService(env.DB)
        const rule = await service.create({
            sku: 'CARROT-500ML',
            platform: 'TIKTOK',
            base_price: 1500,
        })

        expect(rule.sku).toBe('CARROT-500ML')
        expect(rule.platform).toBe('TIKTOK')
        expect(rule.base_price).toBe(1500)
        expect(rule.is_active).toBe(1)
    })

    it('validates platform', async () => {
        const service = new PricingService(env.DB)
        await expect(service.create({
            sku: 'TEST', platform: 'INVALID', base_price: 100,
        })).rejects.toThrow('Invalid platform')
    })

    it('validates positive price', async () => {
        const service = new PricingService(env.DB)
        await expect(service.create({
            sku: 'TEST', platform: 'TIKTOK', base_price: -100,
        })).rejects.toThrow('positive')
    })

    it('records price history on create', async () => {
        const service = new PricingService(env.DB)
        await service.create({
            sku: 'CARROT-500ML', platform: 'TEMU', base_price: 1500,
        }, 1)

        const { history } = await service.getHistory({ sku: 'CARROT-500ML', platform: 'TEMU' })
        expect(history.length).toBe(1)
        expect(history[0].new_price).toBe(1500)
        expect(history[0].change_type).toBe('BASE')
    })

    it('records price history on update', async () => {
        const service = new PricingService(env.DB)
        const rule = await service.create({
            sku: 'GRAPE-500ML', platform: 'RAKUTEN', base_price: 1800,
        })

        await service.update(rule.id, { base_price: 2000 }, 1)

        const { history } = await service.getHistory({ sku: 'GRAPE-500ML', platform: 'RAKUTEN' })
        expect(history.length).toBe(2) // create + update
        expect(history[0].old_price).toBe(1800)
        expect(history[0].new_price).toBe(2000)
    })

    it('batch updates create/update rules', async () => {
        const service = new PricingService(env.DB)
        const result = await service.batchUpdate([
            { sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1600 },
            { sku: 'GRAPE-500ML', platform: 'TEMU', base_price: 2000 },
        ])

        expect(result.updated).toBe(2)
        expect(result.errors.length).toBe(0)
    })

    it('deletes a price rule', async () => {
        const service = new PricingService(env.DB)
        const rule = await service.create({
            sku: 'TEST-DEL', platform: 'ALL', base_price: 999,
        })

        const deleted = await service.delete(rule.id)
        expect(deleted).toBe(true)

        const notFound = await service.getById(rule.id)
        expect(notFound).toBeNull()
    })

    it('calculates margins correctly', async () => {
        const service = new PricingService(env.DB)
        await service.create({
            sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1500,
        })

        const margins = await service.getMargins({ sku: 'CARROT-500ML' })
        expect(margins.length).toBeGreaterThanOrEqual(1)

        const m = margins[0] as any
        expect(m.cost_price).toBe(1200) // from seed
        expect(m.margin).toBe(300)       // 1500 - 1200
    })

    it('lists and filters rules', async () => {
        const service = new PricingService(env.DB)
        await service.create({ sku: 'A', platform: 'TIKTOK', base_price: 100 })
        await service.create({ sku: 'B', platform: 'TEMU', base_price: 200 })

        const all = await service.list()
        expect(all.rules.length).toBe(2)

        const filtered = await service.list({ platform: 'TIKTOK' })
        expect(filtered.rules.length).toBe(1)
    })
})

describe('Pricing Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /pricing creates a rule (admin only)', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/pricing', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1500 }),
        })
        expect(res.status).toBe(201)
    })

    it('POST /pricing requires admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/pricing', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1500 }),
        })
        expect(res.status).toBe(403)
    })

    it('GET /pricing returns list', async () => {
        await SELF.fetch('http://localhost/api/v1/pricing', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1500 }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/pricing', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.rules.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /pricing/history returns price history', async () => {
        await SELF.fetch('http://localhost/api/v1/pricing', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'TEST-HIS', platform: 'TEMU', base_price: 999 }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/pricing/history?sku=TEST-HIS', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.history.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /pricing/margins returns margin data', async () => {
        await SELF.fetch('http://localhost/api/v1/pricing', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1500 }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/pricing/margins', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.margins.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /pricing/export returns CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/pricing/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })

    it('POST /pricing/batch updates multiple prices', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/pricing/batch', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                updates: [
                    { sku: 'CARROT-500ML', platform: 'TIKTOK', base_price: 1600 },
                    { sku: 'GRAPE-500ML', platform: 'TEMU', base_price: 2000 },
                ],
            }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.updated).toBe(2)
    })
})
