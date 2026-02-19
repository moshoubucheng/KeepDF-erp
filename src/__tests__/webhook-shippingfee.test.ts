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
// Webhook Controller
// =========================================================================
describe('Webhook Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /webhooks - creates webhook endpoint', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/webhooks', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://example.com/hook',
                events: ['ORDER_CREATED', 'ORDER_SHIPPED'],
                name: 'Test Hook',
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.url).toBe('https://example.com/hook')
    })

    it('GET /webhooks - lists webhook endpoints', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/webhooks', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.endpoints).toBeDefined()
        expect(Array.isArray(body.endpoints)).toBe(true)
    })

    it('DELETE /webhooks/:id - deletes endpoint', async () => {
        // Create first with valid HTTPS URL and supported events
        const createRes = await SELF.fetch('http://localhost/api/v1/webhooks', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/del', events: ['ORDER_CREATED'], name: 'Del' }),
        })
        expect(createRes.status).toBe(201)
        const created = await createRes.json() as any

        const res = await SELF.fetch(`http://localhost/api/v1/webhooks/${created.id}`, {
            method: 'DELETE',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.success).toBe(true)
    })

    it('requires authentication', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/webhooks')
        expect(res.status).toBe(401)
    })
})

// =========================================================================
// Shipping Fee Controller
// =========================================================================
describe('Shipping Fee Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('GET /shipping-fees/templates - lists templates', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/shipping-fees/templates', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.templates).toBeDefined()
    })

    it('POST /shipping-fees/templates - admin creates template', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/shipping-fees/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Standard Domestic',
                carrier: 'yamato',
                region: 'domestic',
                base_fee: 800,
                weight_fee_per_kg: 200,
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.name).toBe('Standard Domestic')
    })

    it('POST /shipping-fees/templates - distributor is forbidden', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/shipping-fees/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'NG', carrier: 'test', base_fee: 500 }),
        })
        expect(res.status).toBe(403)
    })
})
