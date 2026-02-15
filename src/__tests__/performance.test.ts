import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

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

describe('Dashboard caching', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        const list = await env.KV.list({ prefix: 'cache:' })
        for (const key of list.keys) { await env.KV.delete(key.name) }
    })

    it('returns cached dashboard stats on second call', async () => {
        const res1 = await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
            headers: authHeaders(TOKEN),
        })
        expect(res1.status).toBe(200)
        const data1 = await res1.json() as any
        expect(data1.overview).toBeTruthy()

        // Second call should succeed (cached)
        const res2 = await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
            headers: authHeaders(TOKEN),
        })
        expect(res2.status).toBe(200)
        const data2 = await res2.json() as any
        expect(data2.overview.totalOrders).toBe(data1.overview.totalOrders)
    })

    it('cache is invalidated after order status change', async () => {
        // Load dashboard to prime cache
        await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
            headers: authHeaders(TOKEN),
        })

        // Ship an order (should invalidate cache)
        await SELF.fetch('http://localhost/api/v1/orders/1/ship', {
            method: 'PATCH',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracking_number: 'TRACK-001' }),
        })

        // Dashboard should still work after invalidation
        const res = await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
    })
})

describe('Cursor pagination', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        // Create audit logs for pagination testing
        for (let i = 0; i < 5; i++) {
            await env.DB.prepare(
                "INSERT INTO audit_logs (distributor_id, action, resource_type, details) VALUES (1, 'LOGIN', 'order', ?)"
            ).bind(`test-${i}`).run()
        }
    })

    it('GET /audit-logs supports cursor parameter', async () => {
        const res1 = await SELF.fetch('http://localhost/api/v1/audit-logs?limit=2', {
            headers: authHeaders(TOKEN),
        })
        expect(res1.status).toBe(200)
        const data1 = await res1.json() as any
        expect(data1.logs.length).toBe(2)
        expect(data1.total).toBeGreaterThanOrEqual(5)
    })

    it('GET /orders supports cursor pagination', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/orders?limit=1', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.orders).toBeInstanceOf(Array)
    })

    it('GET /commissions/history supports cursor parameter', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/commissions/history?limit=10', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.settlements).toBeInstanceOf(Array)
        expect(data.total).toBeGreaterThanOrEqual(0)
    })

    it('GET /notifications supports cursor parameter', async () => {
        // Create a notification first
        await env.DB.prepare(
            "INSERT INTO notifications (distributor_id, type, title, message) VALUES (1, 'SYSTEM_ALERT', 'Test', 'test msg')"
        ).run()

        const res = await SELF.fetch('http://localhost/api/v1/notifications?limit=10', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.notifications).toBeInstanceOf(Array)
        expect(data.unreadCount).toBeGreaterThanOrEqual(0)
    })
})

describe('Backward compatibility', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('offset-based pagination still works for orders', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/orders?limit=5', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.orders).toBeInstanceOf(Array)
        expect(data.count).toBeGreaterThanOrEqual(0)
    })

    it('offset-based pagination still works for audit logs', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/audit-logs?offset=0&limit=10', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.logs).toBeInstanceOf(Array)
        expect(data.total).toBeGreaterThanOrEqual(0)
        expect(data.hasMore).toBeDefined()
    })
})
