import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // distributor 1

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

describe('CSV Export Routes', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
    })

    describe('GET /orders/export', () => {
        it('returns text/csv with correct headers', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/export', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toContain('text/csv')
            expect(res.headers.get('Content-Disposition')).toContain('orders.csv')
        })

        it('CSV contains correct Japanese headers', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/export', {
                headers: authHeaders(TOKEN),
            })
            const text = await res.text()
            const firstLine = text.split('\r\n')[0]
            expect(firstLine).toContain('注文ID')
            expect(firstLine).toContain('プラットフォーム')
            expect(firstLine).toContain('ステータス')
        })

        it('CSV contains order data rows', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/export', {
                headers: authHeaders(TOKEN),
            })
            const text = await res.text()
            const lines = text.split('\r\n').filter(l => l.trim())
            // Header + at least 1 data row (distributor 1 has orders in seed)
            expect(lines.length).toBeGreaterThanOrEqual(2)
        })
    })

    describe('GET /commissions/export', () => {
        it('returns text/csv', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/export', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toContain('text/csv')
            expect(res.headers.get('Content-Disposition')).toContain('commissions.csv')
        })

        it('CSV contains correct headers', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/export', {
                headers: authHeaders(TOKEN),
            })
            const text = await res.text()
            const firstLine = text.split('\r\n')[0]
            expect(firstLine).toContain('手数料率')
            expect(firstLine).toContain('手数料')
        })
    })

    describe('GET /invoices/export', () => {
        it('returns text/csv', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/export', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toContain('text/csv')
            expect(res.headers.get('Content-Disposition')).toContain('invoices.csv')
        })

        it('CSV contains correct headers', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/export', {
                headers: authHeaders(TOKEN),
            })
            const text = await res.text()
            const firstLine = text.split('\r\n')[0]
            expect(firstLine).toContain('請求書番号')
            expect(firstLine).toContain('発行日')
        })
    })
})
