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

describe('Platform Sync Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('POST /platform-sync/:platform', () => {
        it('admin can trigger TIKTOK sync', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/tiktok', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.platform).toBe('TIKTOK')
            expect(data.ordersFetched).toBeGreaterThanOrEqual(0)
        })

        it('admin can trigger TEMU sync', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/temu', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.platform).toBe('TEMU')
        })

        it('admin can trigger RAKUTEN sync', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/rakuten', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.platform).toBe('RAKUTEN')
        })

        it('non-admin is rejected (403)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/tiktok', {
                method: 'POST',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('invalid platform returns 400', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/shopify', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toContain('Invalid platform')
        })
    })

    describe('GET /platform-sync/logs', () => {
        it('admin can view sync logs', async () => {
            // Trigger a sync first
            await SELF.fetch('http://localhost/api/v1/platform-sync/tiktok', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })

            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/logs', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.logs).toBeInstanceOf(Array)
            expect(data.logs.length).toBeGreaterThan(0)
            expect(data.logs[0].platform).toBe('TIKTOK')
        })

        it('non-admin cannot view sync logs (403)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/platform-sync/logs', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })
    })
})
