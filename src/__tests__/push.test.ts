import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'
import migrationV18SQL from '../db/migration-v18.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'push_subscriptions',
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
    // Apply migration v18
    for (const stmt of migrationV18SQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Push Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('GET /vapid-key returns public key (no auth)', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/vapid-key')
        expect(resp.status).toBe(200)
        const body = await resp.json() as { publicKey: string }
        expect(body).toHaveProperty('publicKey')
    })

    it('POST /subscribe requires auth', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'https://example.com/push/abc',
                keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
            }),
        })
        expect(resp.status).toBe(401)
    })

    it('POST /subscribe creates subscription', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'https://fcm.googleapis.com/push/abc123',
                keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
            }),
        })
        expect(resp.status).toBe(200)
        const body = await resp.json() as { success: boolean }
        expect(body.success).toBe(true)

        // Verify in DB
        const row = await env.DB.prepare(
            'SELECT * FROM push_subscriptions WHERE distributor_id = 1'
        ).first()
        expect(row).toBeTruthy()
        expect(row!.endpoint).toBe('https://fcm.googleapis.com/push/abc123')
        expect(row!.p256dh).toBe('test-p256dh-key')
    })

    it('POST /subscribe validates body', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: '' }),
        })
        expect(resp.status).toBe(400)
    })

    it('POST /subscribe upserts on duplicate', async () => {
        const endpoint = 'https://fcm.googleapis.com/push/dup'

        // First subscribe
        await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint,
                keys: { p256dh: 'key1', auth: 'auth1' },
            }),
        })

        // Second subscribe with same endpoint, different keys
        await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint,
                keys: { p256dh: 'key2', auth: 'auth2' },
            }),
        })

        // Should have only 1 row
        const { results } = await env.DB.prepare(
            'SELECT * FROM push_subscriptions WHERE distributor_id = 1 AND endpoint = ?'
        ).bind(endpoint).all()
        expect(results.length).toBe(1)
        expect(results[0].p256dh).toBe('key2')
    })

    it('POST /unsubscribe removes subscription', async () => {
        const endpoint = 'https://fcm.googleapis.com/push/to-remove'

        // Subscribe first
        await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint,
                keys: { p256dh: 'key', auth: 'auth' },
            }),
        })

        // Unsubscribe
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/unsubscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
        })
        expect(resp.status).toBe(200)
        const body = await resp.json() as { success: boolean; deleted: boolean }
        expect(body.deleted).toBe(true)

        // Verify gone
        const row = await env.DB.prepare(
            'SELECT * FROM push_subscriptions WHERE endpoint = ?'
        ).bind(endpoint).first()
        expect(row).toBeNull()
    })

    it('POST /unsubscribe validates body', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/unsubscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })
        expect(resp.status).toBe(400)
    })

    it('POST /test requires auth', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
        expect(resp.status).toBe(401)
    })

    it('POST /test returns result for user with no subscriptions', async () => {
        const resp = await SELF.fetch('https://erp.keepdf.com/api/v1/push/test', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })
        expect(resp.status).toBe(200)
        const body = await resp.json() as { success: boolean; sent: number; failed: number }
        expect(body.success).toBe(true)
        expect(body.sent).toBe(0)
        expect(body.failed).toBe(0)
    })

    it('Subscriptions are isolated per distributor', async () => {
        // Sub for distributor 1
        await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'https://fcm.googleapis.com/push/d1',
                keys: { p256dh: 'k1', auth: 'a1' },
            }),
        })

        // Sub for distributor 2
        await SELF.fetch('https://erp.keepdf.com/api/v1/push/subscribe', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'https://fcm.googleapis.com/push/d2',
                keys: { p256dh: 'k2', auth: 'a2' },
            }),
        })

        // Each distributor sees only their own
        const r1 = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE distributor_id = 1').all()
        const r2 = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE distributor_id = 2').all()
        expect(r1.results.length).toBe(1)
        expect(r2.results.length).toBe(1)
        expect(r1.results[0].endpoint).toBe('https://fcm.googleapis.com/push/d1')
        expect(r2.results[0].endpoint).toBe('https://fcm.googleapis.com/push/d2')
    })
})
