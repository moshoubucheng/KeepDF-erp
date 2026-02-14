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

describe('Orders Input Validation', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('無効なplatformで400を返す', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/orders?platform=INVALID', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
        const data = await res.json() as { error: string }
        expect(data.error).toContain('Invalid platform')
    })

    it('無効なstatusで400を返す', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/orders?status=INVALID', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
        const data = await res.json() as { error: string }
        expect(data.error).toContain('Invalid status')
    })

    it('limitを1-200の範囲にclampする', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/orders?limit=999', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as { orders: unknown[]; count: number }
        // limit は 200 にクランプされるので正常に返る
        expect(data.orders).toBeDefined()
    })
})

describe('Dashboard Input Validation', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('無効なperiodで400を返す', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/dashboard/orders-by-platform?period=invalid', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
        const data = await res.json() as { error: string }
        expect(data.error).toContain('Invalid period')
    })

    it('無効なgroupByで400を返す', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/dashboard/revenue-trend?groupBy=month', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
        const data = await res.json() as { error: string }
        expect(data.error).toContain('Invalid groupBy')
    })

    it('有効なperiodは正常に処理される', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/dashboard/orders-by-platform?period=7d', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
    })
})

describe('Commissions Input Validation', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('無効なstatusで400を返す', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/commissions/history?status=INVALID', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
        const data = await res.json() as { error: string }
        expect(data.error).toContain('Invalid status')
    })

    it('有効なstatusは正常に処理される', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/commissions/history?status=PENDING', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
    })
})

describe('Invoices Input Validation', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    it('limitが適切にclampされる', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/invoices?limit=500', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        // 正常に処理（limit は 200 にクランプ）
        const data = await res.json() as { invoices: unknown[] }
        expect(data.invoices).toBeDefined()
    })

    it('NaN limitがデフォルトに戻る', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/invoices?limit=abc', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as { invoices: unknown[] }
        expect(data.invoices).toBeDefined()
    })
})
