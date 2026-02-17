import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // 分销商 1 的 token
const TOKEN_2 = 'tok_dev_def456' // 分销商 2 的 token

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

describe('Orders Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        // 清理 KV 中的 session 缓存
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
        await env.KV.delete('session:invalid_token')
    })

    describe('GET /api/v1/orders', () => {
        it('返回当前分销商的订单列表', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.orders).toBeDefined()
            expect(data.count).toBeGreaterThan(0)
            for (const order of data.orders) {
                expect(order.distributor_id).toBe(1)
            }
        })

        it('按平台筛选订单', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders?platform=tiktok', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            for (const order of data.orders) {
                expect(order.platform).toBe('TIKTOK')
            }
        })

        it('按状态筛选订单', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders?status=shipped', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            for (const order of data.orders) {
                expect(order.status).toBe('SHIPPED')
            }
        })

        it('无 token 返回 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders')
            expect(res.status).toBe(401)
        })

        it('无效 token 返回 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders', {
                headers: authHeaders('invalid_token'),
            })
            expect(res.status).toBe(403)
        })
    })

    describe('GET /api/v1/orders/:id', () => {
        it('返回订单详情和明细', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/1', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.order).toBeDefined()
            expect(data.order.id).toBe(1)
            expect(data.items).toBeDefined()
            expect(data.items.length).toBeGreaterThan(0)
        })

        it('访问不属于自己的订单返回 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/1', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('不存在的订单返回 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/999', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('PATCH /api/v1/orders/:id/ship', () => {
        it('发货成功', async () => {
            // 订单 3 属于分销商 2, 状态为 PROCESSING
            const res = await SELF.fetch('http://localhost/api/v1/orders/3/ship', {
                method: 'PATCH',
                headers: {
                    ...authHeaders(TOKEN_2),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tracking_number: 'JP-TEST-1234567890' }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.status).toBe('shipped')
            expect(data.tracking).toBe('JP-TEST-1234567890')

            // 验证数据库状态已更新
            const order = await env.DB.prepare('SELECT status FROM orders WHERE id = 3').first<{ status: string }>()
            expect(order!.status).toBe('SHIPPED')
        })

        it('发货别人的订单返回 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/4/ship', {
                method: 'PATCH',
                headers: {
                    ...authHeaders(TOKEN),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tracking_number: 'JP-TEST-9999999' }),
            })
            expect(res.status).toBe(403)
        })

        it('不存在的订单返回 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/999/ship', {
                method: 'PATCH',
                headers: {
                    ...authHeaders(TOKEN),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tracking_number: 'JP-TEST-0000000' }),
            })
            expect(res.status).toBe(404)
        })
    })
})
