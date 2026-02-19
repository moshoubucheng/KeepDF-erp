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
// Suppliers
// =========================================================================
describe('Suppliers Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /suppliers - admin creates supplier', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Supplier', contact_name: 'Taro', email: 'taro@test.com' }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.supplier).toBeDefined()
        expect(body.supplier.name).toBe('Test Supplier')
    })

    it('GET /suppliers - admin lists suppliers', async () => {
        // Create one first
        await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Supplier A', contact_name: 'A' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.suppliers).toBeDefined()
        expect(body.suppliers.length).toBeGreaterThan(0)
    })

    it('GET /suppliers - distributor is forbidden', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(403)
    })

    it('DELETE /suppliers/:id - admin deactivates supplier', async () => {
        const createRes = await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'To Delete', contact_name: 'Del' }),
        })
        const { supplier } = await createRes.json() as any

        const res = await SELF.fetch(`http://localhost/api/v1/suppliers/${supplier.id}`, {
            method: 'DELETE',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.success).toBe(true)
    })
})

// =========================================================================
// Approvals
// =========================================================================
describe('Approval Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /approvals/workflows - admin creates workflow', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/approvals/workflows', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Purchase Order Approval',
                resource_type: 'PURCHASE_ORDER',
                conditions: { min_amount: 10000 },
                approver_ids: [1],
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.name).toBe('Purchase Order Approval')
    })

    it('GET /approvals/workflows - admin lists workflows', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/approvals/workflows', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.workflows).toBeDefined()
        expect(Array.isArray(body.workflows)).toBe(true)
    })

    it('GET /approvals/requests - any user can list requests', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/approvals/requests', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.requests).toBeDefined()
    })

    it('POST /approvals/workflows - distributor is forbidden', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/approvals/workflows', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'NG', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] }),
        })
        expect(res.status).toBe(403)
    })
})
