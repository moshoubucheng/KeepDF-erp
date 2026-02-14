import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // distributor 1 = admin
const TOKEN_2 = 'tok_dev_def456' // distributor 2 = distributor

const TABLE_NAMES = [
    'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
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

describe('Admin Middleware & RBAC', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('Auth middleware sets role', () => {
        it('admin token sets role to admin in KV', async () => {
            // Login to populate KV session
            await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: TOKEN }),
            })

            const cached = await env.KV.get(`session:${TOKEN}`)
            expect(cached).toBe('1:admin')
        })

        it('distributor token sets role to distributor in KV', async () => {
            await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: TOKEN_2 }),
            })

            const cached = await env.KV.get(`session:${TOKEN_2}`)
            expect(cached).toBe('2:distributor')
        })

        it('login response includes role field', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: TOKEN }),
            })
            const data = await res.json() as any
            expect(data.distributor.role).toBe('admin')
        })

        it('/me response includes role field', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/me', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            expect(data.distributor.role).toBe('admin')
        })
    })

    describe('KV cache backward compatibility', () => {
        it('old format (no colon) defaults to distributor role', async () => {
            // Simulate old KV format
            await env.KV.put(`session:${TOKEN}`, '1', { expirationTtl: 3600 })

            const res = await SELF.fetch('http://localhost/api/v1/auth/me', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.distributor.id).toBe(1)
        })
    })

    describe('adminOnly middleware', () => {
        it('admin can access admin-only routes (platform-sync)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/logs', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
        })

        it('distributor is rejected from admin-only routes (403)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/logs', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
            const data = await res.json() as any
            expect(data.error).toContain('admin')
        })

        it('unauthenticated request returns 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/logs')
            expect(res.status).toBe(401)
        })
    })
})
