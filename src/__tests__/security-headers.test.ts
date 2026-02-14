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

describe('Security Headers', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('レスポンスにセキュリティヘッダーが含まれる', async () => {
        const res = await SELF.fetch('http://localhost/health')
        expect(res.status).toBe(200)
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
        expect(res.headers.get('X-Frame-Options')).toBe('DENY')
        expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
        expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()')
        expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    })

    it('API レスポンスにもセキュリティヘッダーが含まれる', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/orders', {
            headers: { Authorization: `Bearer ${TOKEN}` },
        })
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
        expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    })
})

describe('Error Message Leak Prevention', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('エラーレスポンスに内部情報が含まれない', async () => {
        // 404 エラーテスト
        const res = await SELF.fetch('http://localhost/nonexistent/path')
        expect(res.status).toBe(404)
        const data = await res.json() as { error: string; message?: string }
        expect(data.error).toBe('Not Found')
        expect(data.message).toBeUndefined()
    })
})

describe('CORS Restriction', () => {
    it('許可されたオリジンからのリクエストに CORS ヘッダーを返す', async () => {
        const res = await SELF.fetch('http://localhost/health', {
            headers: { Origin: 'http://localhost:8787' },
        })
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8787')
    })

    it('許可されていないオリジンには CORS ヘッダーを返さない', async () => {
        const res = await SELF.fetch('http://localhost/health', {
            headers: { Origin: 'http://evil.com' },
        })
        expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
})
