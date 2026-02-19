import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin
const TOKEN_2 = 'tok_dev_def456' // distributor

const TABLE_NAMES = [
    'api_logs', 'approval_requests', 'approval_workflows', 'audit_logs', 'audit_snapshots',
    'automation_logs', 'automation_rules', 'backup_snapshots', 'commission_settlements', 'commissions',
    'coupon_usage', 'coupons', 'customer_messages', 'customer_segments', 'customers',
    'dashboard_layouts', 'distributors', 'exchange_rates', 'import_logs', 'inbound_records',
    'inventory_forecasts', 'invoices', 'message_templates', 'message_triggers', 'notification_logs',
    'notification_preferences', 'notifications', 'order_items', 'orders', 'outbound_records',
    'platform_mappings', 'platform_sync_logs', 'price_history', 'price_rules', 'product_variants',
    'products', 'promotions', 'purchase_order_items', 'purchase_orders', 'push_subscriptions',
    'return_items', 'returns', 'shipment_events', 'shipments', 'shipping_fee_templates',
    'shipping_fees', 'stocktake_items', 'stocktakes', 'suppliers', 'wallet_transactions',
    'warehouse_locations', 'webhook_endpoints', 'webhook_logs',
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

describe('Inventory Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('GET /inventory - lists products with stock', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.products).toBeDefined()
        expect(Array.isArray(body.products)).toBe(true)
        expect(body.products.length).toBeGreaterThan(0)
        expect(body.products[0]).toHaveProperty('sku')
        expect(body.products[0]).toHaveProperty('total_stock')
    })

    it('GET /inventory/:sku - returns product detail with locations', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/CARROT-500ML', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.product).toBeDefined()
        expect(body.product.sku).toBe('CARROT-500ML')
        expect(body.locations).toBeDefined()
        expect(Array.isArray(body.locations)).toBe(true)
    })

    it('GET /inventory/:sku - returns 404 for unknown SKU', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/NONEXIST-999', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(404)
    })

    it('POST /inventory/products - creates a new product', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/products', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'TEST-NEW-001', cost_price: 1500, name_jp: 'テスト商品' }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.status).toBe('created')
        expect(body.sku).toBe('TEST-NEW-001')
    })

    it('POST /inventory/products - rejects invalid cost_price', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/products', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'BAD-001', cost_price: -100 }),
        })
        expect(res.status).toBe(400)
    })

    it('POST /inventory/inbound - records inbound with stock update', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/inbound', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'CARROT-500ML', location_code: 'A-1-1', expected_qty: 100, actual_qty: 100 }),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.status).toBe('inbound_recorded')
    })

    it('PUT /inventory/products/:id - admin can update product', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1', {
            method: 'PUT',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name_jp: '更新された商品名' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.product).toBeDefined()
        expect(body.product.name_jp).toBe('更新された商品名')
    })

    it('PUT /inventory/products/:id - distributor is forbidden', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1', {
            method: 'PUT',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name_jp: 'NG' }),
        })
        expect(res.status).toBe(403)
    })
})
