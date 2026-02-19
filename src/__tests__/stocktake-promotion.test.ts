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

// =========================================================================
// Stocktake Controller
// =========================================================================
describe('Stocktake Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /stocktakes - admin creates stocktake', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/stocktakes', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Monthly stocktake' }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        // service returns getDetail() which has stocktake nested
        expect(body.stocktake || body.code || body.id).toBeDefined()
    })

    it('GET /stocktakes - admin lists stocktakes', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/stocktakes', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.stocktakes).toBeDefined()
    })

    it('POST /stocktakes/:id/start - starts stocktake counting', async () => {
        // Create first
        const createRes = await SELF.fetch('http://localhost/api/v1/stocktakes', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Start test' }),
        })
        const created = await createRes.json() as any
        // getDetail returns { stocktake: { id, ... }, items: [...] }
        const stocktakeId = created.stocktake?.id || created.id

        const res = await SELF.fetch(`http://localhost/api/v1/stocktakes/${stocktakeId}/start`, {
            method: 'POST',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
    })

    it('GET /stocktakes - distributor is forbidden', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/stocktakes', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(403)
    })
})

// =========================================================================
// Promotion Controller
// =========================================================================
describe('Promotion Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /promotions - admin creates promotion', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/promotions', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Summer Sale',
                type: 'PERCENTAGE',
                discount_value: 10,
                start_date: '2025-01-01',
                end_date: '2025-12-31',
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.name).toBe('Summer Sale')
    })

    it('GET /promotions - lists promotions for any role', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/promotions', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.promotions).toBeDefined()
    })

    it('POST /promotions - distributor is forbidden', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/promotions', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'NG', type: 'PERCENTAGE', discount_value: 5, start_date: '2025-01-01', end_date: '2025-12-31' }),
        })
        expect(res.status).toBe(403)
    })

    it('GET /promotions/applicable/:orderId - finds applicable promotions', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/promotions/applicable/1', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.promotions).toBeDefined()
        expect(Array.isArray(body.promotions)).toBe(true)
    })
})
