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
// Communications Controller
// =========================================================================
describe('Communications Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /communications/templates - creates template', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Order Confirmation',
                type: 'ORDER_CONFIRMATION',
                subject: 'ご注文確認',
                body: 'ご注文ありがとうございます。注文番号: {{order_number}}',
                channel: 'EMAIL',
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.template).toBeDefined()
        expect(body.template.name).toBe('Order Confirmation')
    })

    it('GET /communications/templates - lists templates', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/templates', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.templates).toBeDefined()
    })

    it('GET /communications/messages - lists message history', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/messages', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.messages).toBeDefined()
    })

    it('requires authentication', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/templates')
        expect(res.status).toBe(401)
    })
})

// =========================================================================
// Customer Segment Controller
// =========================================================================
describe('Customer Segment Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('GET /customer-segments/rfm - calculates RFM scores', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customer-segments/rfm', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.customers).toBeDefined()
        expect(typeof body.total).toBe('number')
    })

    it('POST /customer-segments/segments - creates segment', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customer-segments/segments', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'VIP Customers',
                conditions: JSON.stringify({ min_orders: 10, min_revenue: 100000 }),
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.name).toBe('VIP Customers')
    })

    it('GET /customer-segments/segments - lists segments', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customer-segments/segments', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.segments).toBeDefined()
    })

    it('GET /customer-segments/rfm/distribution - returns distribution', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customer-segments/rfm/distribution', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
    })
})

// =========================================================================
// Audit Recovery (quick coverage)
// =========================================================================
describe('Audit Recovery', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('requires authentication', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/audit-recovery/snapshots')
        expect(res.status).toBe(401)
    })
})
