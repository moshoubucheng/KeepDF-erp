import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

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

describe('Login Rate Limiting', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        // 清理所有 rate limit 相关 KV
        const keys = await env.KV.list({ prefix: 'ratelimit:' })
        for (const key of keys.keys) {
            await env.KV.delete(key.name)
        }
    })

    it('5回ログイン試行後に429を返す', async () => {
        const loginPayload = JSON.stringify({ username: 'admin', password: 'wrong' })

        // 5回のログイン試行（成功しなくても回数カウント）
        for (let i = 0; i < 5; i++) {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'cf-connecting-ip': '1.2.3.4',
                },
                body: loginPayload,
            })
            // ログイン失敗は 401 または他のステータス（限流前）
            expect(res.status).not.toBe(429)
        }

        // 6回目はレート制限
        const rateLimited = await SELF.fetch('http://localhost/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'cf-connecting-ip': '1.2.3.4',
            },
            body: loginPayload,
        })
        expect(rateLimited.status).toBe(429)
        const data = await rateLimited.json() as { error: string }
        expect(data.error).toContain('Too many login attempts')
    })

    it('異なるIPはレート制限を共有しない', async () => {
        const loginPayload = JSON.stringify({ username: 'admin', password: 'wrong' })

        // IP A で5回
        for (let i = 0; i < 5; i++) {
            await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'cf-connecting-ip': '10.0.0.1',
                },
                body: loginPayload,
            })
        }

        // IP B はまだ制限されない
        const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'cf-connecting-ip': '10.0.0.2',
            },
            body: loginPayload,
        })
        expect(res.status).not.toBe(429)
    })
})
