import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // distributor 1 = admin
const TOKEN_2 = 'tok_dev_def456' // distributor 2 = distributor

const TABLE_NAMES = [
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

describe('Distributors Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('GET /api/v1/distributors', () => {
        it('lists distributors with pagination', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.distributors.length).toBeGreaterThanOrEqual(2)
            expect(data.total).toBeGreaterThanOrEqual(2)
            // Admin should not appear in distributor list
            const roles = data.distributors.map((d: any) => d.role)
            expect(roles).not.toContain('admin')
        })

        it('supports limit and offset', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors?limit=1&offset=0', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.distributors.length).toBe(1)
            expect(data.hasMore).toBe(true)
        })
    })

    describe('GET /api/v1/distributors/:id', () => {
        it('returns distributor detail with aggregated stats', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors/1', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.distributor.name).toBeDefined()
            expect(typeof data.orderCount).toBe('number')
            expect(typeof data.commissionTotal).toBe('number')
        })

        it('returns 404 for non-existent distributor', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors/999', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('POST /api/v1/distributors', () => {
        it('creates distributor with token', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '\u65B0\u898F\u30C6\u30B9\u30C8', role: 'distributor' }),
            })
            expect(res.status).toBe(201)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.distributor.token).toMatch(/^tok_[a-f0-9]{32}$/)
            expect(data.distributor.name).toBe('\u65B0\u898F\u30C6\u30B9\u30C8')
        })

        it('validates name is required', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            expect(res.status).toBe(400)
        })
    })

    describe('PUT /api/v1/distributors/:id', () => {
        it('updates distributor fields', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors/2', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '\u66F4\u65B0\u540D\u524D' }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.distributor.name).toBe('\u66F4\u65B0\u540D\u524D')
        })
    })

    describe('POST /api/v1/distributors/:id/reset-token', () => {
        it('resets token and invalidates old session', async () => {
            // Pre-cache session for distributor 2
            await env.KV.put(`session:${TOKEN_2}`, '2:distributor', { expirationTtl: 3600 })

            const res = await SELF.fetch('http://localhost/api/v1/distributors/2/reset-token', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.token).toMatch(/^tok_/)
            expect(data.token).not.toBe(TOKEN_2)

            // Old session should be deleted
            const oldSession = await env.KV.get(`session:${TOKEN_2}`)
            expect(oldSession).toBeNull()
        })
    })

    describe('Non-admin access', () => {
        it('returns 403 for distributor role', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })
    })

    describe('GET /api/v1/distributors/export', () => {
        it('exports CSV', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/distributors/export', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toContain('text/csv')
            const csv = await res.text()
            expect(csv).toContain('ID')
        })
    })
})
