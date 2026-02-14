import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'
const TOKEN_2 = 'tok_dev_def456'

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

describe('Auth Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('POST /api/v1/auth/login', () => {
        it('有効なトークンでログイン成功', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: TOKEN }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.distributor.id).toBe(1)
            expect(data.distributor.name).toBeDefined()
            expect(data.expiresIn).toBe(3600)
        })

        it('無効なトークンで401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'invalid_token' }),
            })
            expect(res.status).toBe(401)
        })

        it('トークン未指定で400', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            expect(res.status).toBe(400)
        })
    })

    describe('GET /api/v1/auth/me', () => {
        it('認証済みでユーザー情報を返す', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/me', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.distributor.id).toBe(1)
            expect(data.distributor.name).toBeDefined()
        })

        it('未認証で401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/me')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /api/v1/auth/logout', () => {
        it('ログアウト成功', async () => {
            // ログイン
            await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: TOKEN }),
            })

            const cached = await env.KV.get(`session:${TOKEN}`)
            expect(cached).toBe('1:admin')

            // ログアウト
            const res = await SELF.fetch('http://localhost/api/v1/auth/logout', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)

            const deleted = await env.KV.get(`session:${TOKEN}`)
            expect(deleted).toBeNull()
        })
    })
})
