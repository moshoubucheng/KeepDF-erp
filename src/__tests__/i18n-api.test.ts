import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'

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

describe('i18n API - Language Preference', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('POST /auth/language saves language preference', async () => {
        // Login first to create session
        await SELF.fetch('http://localhost/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/auth/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(TOKEN) },
            body: JSON.stringify({ language: 'en' }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(true)
        expect(data.language).toBe('en')

        // Verify DB was updated
        const dist = await env.DB.prepare('SELECT language FROM distributors WHERE id = 1')
            .first<{ language: string }>()
        expect(dist?.language).toBe('en')
    })

    it('invalid language returns 400', async () => {
        await SELF.fetch('http://localhost/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/auth/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(TOKEN) },
            body: JSON.stringify({ language: 'fr' }),
        })
        expect(res.status).toBe(400)
    })

    it('login returns language field', async () => {
        // Set language first
        await env.DB.prepare('UPDATE distributors SET language = ? WHERE id = 1').bind('zh').run()

        const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.distributor.language).toBe('zh')
    })

    it('unauthenticated request returns 401', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/auth/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'en' }),
        })
        expect(res.status).toBe(401)
    })
})
