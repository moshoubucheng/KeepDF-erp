import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // 分销商 1
const TOKEN_2 = 'tok_dev_def456' // 分销商 2

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

describe('Commissions Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('GET /api/v1/commissions/rates', () => {
        it('返回全部佣金费率表', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/rates', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.rates).toBeDefined()
            expect(data.count).toBe(7)
        })

        it('按平台筛选费率', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/rates?platform=TIKTOK', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.count).toBe(3)
            for (const rate of data.rates) {
                expect(rate.platform).toBe('TIKTOK')
            }
        })

        it('按 SKU 筛选费率', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/rates?sku=CARROT-500ML', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.count).toBe(2)
            for (const rate of data.rates) {
                expect(rate.sku).toBe('CARROT-500ML')
            }
        })
    })

    describe('GET /api/v1/commissions/calculate/:orderId', () => {
        it('计算订单佣金（TIKTOK 订单 1）', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/calculate/1', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.orderId).toBe(1)
            expect(data.platform).toBe('TIKTOK')
            expect(data.items).toHaveLength(2)
            // CARROT-500ML: Math.floor(1200 * 2 * 0.05) = 120
            // GRAPE-500ML:  Math.floor(1500 * 1 * 0.05) = 75
            expect(data.totalCommission).toBe(195)
        })

        it('计算订单佣金（TEMU 订单 2）', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/calculate/2', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.orderId).toBe(2)
            expect(data.platform).toBe('TEMU')
            // FACE-MASK-30: Math.floor(3800 * 2 * 0.10) = 760
            expect(data.totalCommission).toBe(760)
        })

        it('不属于自己的订单返回 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/calculate/1', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('不存在的订单返回 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/calculate/999', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('POST /api/v1/commissions/settle', () => {
        it('批量结算佣金成功', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: {
                    ...authHeaders(TOKEN),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderIds: [1, 2] }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.settled).toBe(2)
            expect(data.failed).toBe(0)
            expect(data.totalAmount).toBe(955)
            expect(data.newBalance).toBe(500000 - 955)

            const distributor = await env.DB.prepare(
                'SELECT balance FROM distributors WHERE id = 1'
            ).first<{ balance: number }>()
            expect(distributor!.balance).toBe(500000 - 955)
        })

        it('重复结算同一订单应标记失败', async () => {
            await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [1] }),
            })

            const res = await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [1] }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.failed).toBe(1)
            expect(data.details[0].error).toBe('Already settled')
        })

        it('余额不足返回 400', async () => {
            await env.DB.prepare('UPDATE distributors SET balance = 10 WHERE id = 1').run()

            const res = await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [1] }),
            })
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toBe('Insufficient balance')
        })

        it('结算不属于自己的订单返回 400', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [3] }),
            })
            expect(res.status).toBe(400)
        })

        it('空数组返回 400', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [] }),
            })
            expect(res.status).toBe(400)
        })
    })

    describe('GET /api/v1/commissions/history', () => {
        it('结算后能查到历史记录', async () => {
            await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [1] }),
            })

            const res = await SELF.fetch('http://localhost/api/v1/commissions/history', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.settlements.length).toBeGreaterThan(0)
            expect(data.total).toBeGreaterThan(0)
        })

        it('无结算记录时返回空列表', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/commissions/history', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.settlements).toHaveLength(0)
            expect(data.hasMore).toBe(false)
        })

        it('不同分销商看不到彼此的结算记录', async () => {
            await SELF.fetch('http://localhost/api/v1/commissions/settle', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [1] }),
            })

            const res = await SELF.fetch('http://localhost/api/v1/commissions/history', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.settlements).toHaveLength(0)
        })
    })
})
