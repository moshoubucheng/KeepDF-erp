import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // 分销商 1
const TOKEN_2 = 'tok_dev_def456' // 分销商 2

const TABLE_NAMES = [
    'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
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

describe('Invoices Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('POST /api/v1/invoices/generate/:orderId', () => {
        it('成功生成适格请求书', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト買主株式会社', invoiceDate: '2026-02-11' }),
            })
            expect(res.status).toBe(201)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.invoice.invoice_number).toBe('INV-20260211-1')
            expect(data.invoice.tax_details.invoiceType).toBe('適格請求書')
            // 订单 1 的商品是 reduced 税率 (8%)
            expect(data.invoice.tax_details.items.length).toBe(2)
        })

        it('重复生成返回 400', async () => {
            await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト買主' }),
            })

            const res = await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト買主' }),
            })
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toContain('already exists')
        })

        it('别人的订单返回 403', async () => {
            // 订单 3 属于分销商 2
            const res = await SELF.fetch('http://localhost/api/v1/invoices/generate/3', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト' }),
            })
            expect(res.status).toBe(403)
        })

        it('不存在的订单返回 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/generate/999', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト' }),
            })
            expect(res.status).toBe(404)
        })

        it('缺少 buyerName 返回 400', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toContain('Buyer name')
        })
    })

    describe('GET /api/v1/invoices/:id', () => {
        it('获取 Invoice 详情', async () => {
            // 先生成
            const createRes = await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト買主' }),
            })
            const created = await createRes.json() as any

            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${created.invoice.id}`, {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.invoice).toBeDefined()
            expect(data.invoice.tax_details.invoiceType).toBe('適格請求書')
            expect(data.order).toBeDefined()
            expect(data.order.platform).toBe('TIKTOK')
        })

        it('不存在的 Invoice 返回 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/999', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })

        it('别人的 Invoice 返回 403', async () => {
            // 分销商 1 生成订单 1 的 Invoice
            const createRes = await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト' }),
            })
            const created = await createRes.json() as any

            // 分销商 2 尝试访问
            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${created.invoice.id}`, {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })
    })

    describe('GET /api/v1/invoices', () => {
        it('返回分销商的 Invoice 列表', async () => {
            // 生成两个 Invoice
            await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト買主' }),
            })
            await SELF.fetch('http://localhost/api/v1/invoices/generate/2', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerName: 'テスト買主 2' }),
            })

            const res = await SELF.fetch('http://localhost/api/v1/invoices', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.invoices.length).toBe(2)
            expect(data.total).toBe(2)
            expect(data.hasMore).toBe(false)
        })

        it('空列表', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.invoices).toHaveLength(0)
        })
    })
})
