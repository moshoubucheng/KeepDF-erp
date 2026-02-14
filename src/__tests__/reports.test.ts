import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

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

describe('Reports Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    // ===== Summary =====
    describe('GET /api/v1/reports/summary', () => {
        it('returns KPI data for admin (sees all)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/summary?period=all', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.orderCount).toBe(5)
            expect(data.revenue).toBe(24200) // sum of all order total_amounts
            expect(data.avgValue).toBe(4840) // 24200 / 5
            expect(data.topProduct).toBeTruthy()
        })

        it('data isolation: dist2 sees only own data', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/summary?period=all', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.orderCount).toBe(2)  // orders #3, #4
            expect(data.revenue).toBe(9400)  // 5600 + 3800
        })

        it('returns 401 without auth', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/summary')
            expect(res.status).toBe(401)
        })
    })

    // ===== Profit Analysis =====
    describe('GET /api/v1/reports/profit-analysis', () => {
        it('group_by=product returns per-product profit', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/profit-analysis?period=all&group_by=product', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(Array.isArray(data.data)).toBe(true)
            expect(data.data.length).toBeGreaterThan(0)
            // Each item should have sku, revenue, cost, profit, margin
            const first = data.data[0]
            expect(first).toHaveProperty('sku')
            expect(first).toHaveProperty('revenue')
            expect(first).toHaveProperty('cost')
            expect(first).toHaveProperty('profit')
            expect(first).toHaveProperty('margin')
        })

        it('group_by=platform returns per-platform profit', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/profit-analysis?period=all&group_by=platform', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.data.length).toBeGreaterThan(0)
            const first = data.data[0]
            expect(first).toHaveProperty('platform')
        })

        it('margin is 0% for seed data (cost == sell price)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/profit-analysis?period=all&group_by=product', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            // All products in seed have unit_price == cost_price, so margin should be 0
            for (const item of data.data) {
                expect(item.margin).toBe(0)
                expect(item.profit).toBe(0)
            }
        })

        it('returns 400 for invalid period', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/profit-analysis?period=invalid', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(400)
        })

        it('returns 401 without auth', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/profit-analysis')
            expect(res.status).toBe(401)
        })
    })

    // ===== Platform Comparison =====
    describe('GET /api/v1/reports/platform-comparison', () => {
        it('returns all 3 platforms for admin', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/platform-comparison?period=all', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.platforms.length).toBe(3)

            const platforms = data.platforms.map((p: any) => p.platform).sort()
            expect(platforms).toEqual(['RAKUTEN', 'TEMU', 'TIKTOK'])
        })

        it('period=all includes all orders', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/platform-comparison?period=all', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            const totalOrders = data.platforms.reduce((s: number, p: any) => s + p.orderCount, 0)
            expect(totalOrders).toBe(5)
        })

        it('data isolation: dist2 sees only own platforms', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/platform-comparison?period=all', {
                headers: authHeaders(TOKEN_2),
            })
            const data = await res.json() as any
            const totalOrders = data.platforms.reduce((s: number, p: any) => s + p.orderCount, 0)
            expect(totalOrders).toBe(2) // orders #3, #4
        })
    })

    // ===== Trend Comparison =====
    describe('GET /api/v1/reports/trend-comparison', () => {
        it('returns current and previous period data', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/trend-comparison?period=30d', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(Array.isArray(data.current)).toBe(true)
            expect(Array.isArray(data.previous)).toBe(true)
            expect(data.summary).toBeDefined()
            expect(data.summary.currentRevenue).toBeGreaterThanOrEqual(0)
        })

        it('growth is computed correctly', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/trend-comparison?period=30d', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            // All seed orders are created "now", so previous should be empty
            expect(data.summary.previousRevenue).toBe(0)
            // Growth should be null when previous = 0
            expect(data.summary.revenueGrowth).toBeNull()
        })

        it('returns 400 for period=all', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/reports/trend-comparison?period=all', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(400)
        })
    })

    // ===== Custom Report =====
    describe('GET /api/v1/reports/custom', () => {
        it('returns custom grouped data', async () => {
            const today = new Date().toISOString().slice(0, 10)
            const past = '2020-01-01'
            const res = await SELF.fetch(
                `http://localhost/api/v1/reports/custom?start_date=${past}&end_date=${today}&dimensions=platform&metrics=orders,revenue`,
                { headers: authHeaders(TOKEN) }
            )
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(Array.isArray(data.data)).toBe(true)
            expect(data.data.length).toBeGreaterThan(0)
            const first = data.data[0]
            expect(first).toHaveProperty('platform')
            expect(first).toHaveProperty('orders')
            expect(first).toHaveProperty('revenue')
        })

        it('returns 400 for invalid dimension', async () => {
            const res = await SELF.fetch(
                'http://localhost/api/v1/reports/custom?start_date=2020-01-01&end_date=2030-12-31&dimensions=invalid&metrics=orders',
                { headers: authHeaders(TOKEN) }
            )
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toContain('Invalid dimension')
        })
    })

    // ===== Custom Report CSV Export =====
    describe('GET /api/v1/reports/custom/export', () => {
        it('returns CSV content type', async () => {
            const today = new Date().toISOString().slice(0, 10)
            const res = await SELF.fetch(
                `http://localhost/api/v1/reports/custom/export?start_date=2020-01-01&end_date=${today}&dimensions=platform&metrics=orders,revenue`,
                { headers: authHeaders(TOKEN) }
            )
            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toContain('text/csv')
        })

        it('CSV headers match metrics', async () => {
            const today = new Date().toISOString().slice(0, 10)
            const res = await SELF.fetch(
                `http://localhost/api/v1/reports/custom/export?start_date=2020-01-01&end_date=${today}&dimensions=platform&metrics=orders,revenue`,
                { headers: authHeaders(TOKEN) }
            )
            const text = await res.text()
            const firstLine = text.split('\r\n')[0]
            expect(firstLine).toBe('platform,orders,revenue')
        })
    })
})
