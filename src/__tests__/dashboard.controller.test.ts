import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // 分销商 1
const TOKEN_2 = 'tok_dev_def456' // 分销商 2

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

describe('Dashboard Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('GET /api/v1/dashboard/stats', () => {
        it('返回分销商 1 的统计数据', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.overview.totalOrders).toBe(2)
            expect(data.overview.totalRevenue).toBe(4800)
            expect(data.wallet.balance).toBe(500000)
        })

        it('分销商 2 看到自己的数据', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.overview.totalOrders).toBe(2)
            expect(data.overview.totalRevenue).toBe(0)
            expect(data.wallet.balance).toBe(300000)
            expect(data.wallet.frozen_balance).toBe(50000)
        })

        it('商品总数和低库存统计', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/stats', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.overview.totalProducts).toBe(6)
            expect(data.overview.lowStockCount).toBe(0)
        })

        it('未认证返回 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/stats')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /api/v1/dashboard/orders-by-platform', () => {
        it('按平台统计订单', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/orders-by-platform?period=all', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.platforms).toBeDefined()
            expect(data.total.orders).toBe(2)

            const totalPct = data.platforms.reduce((s: number, p: any) => s + p.percentage, 0)
            expect(totalPct).toBeGreaterThanOrEqual(99)
            expect(totalPct).toBeLessThanOrEqual(101)
        })

        it('未认证返回 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/orders-by-platform')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /api/v1/dashboard/revenue-trend', () => {
        it('返回收入趋势数据', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/revenue-trend', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.period).toBe('30d')
            expect(data.groupBy).toBe('day')
            expect(Array.isArray(data.data)).toBe(true)
        })

        it('未认证返回 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/revenue-trend')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /api/v1/dashboard/low-stock', () => {
        it('threshold=1000 返回所有产品', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/low-stock?threshold=1000', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.threshold).toBe(1000)
            expect(data.count).toBe(6)
        })

        it('threshold=1 返回空列表', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/low-stock?threshold=1', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.count).toBe(0)
        })

        it('未认证返回 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/low-stock')
            expect(res.status).toBe(401)
        })
    })
})
