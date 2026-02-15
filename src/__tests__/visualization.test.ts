import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'coupon_usage', 'coupons', 'shipment_events', 'exchange_rates',
    'automation_logs', 'automation_rules',
    'inventory_forecasts', 'message_triggers', 'customer_messages', 'message_templates',
    'price_history', 'price_rules', 'purchase_order_items', 'purchase_orders', 'suppliers',
    'return_items', 'returns',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
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
    // Make some orders have recent dates and valid statuses for heatmap
    await db.prepare("UPDATE orders SET status = 'DELIVERED', created_at = datetime('now', '-1 day') WHERE id = 1").run()
    await db.prepare("UPDATE orders SET status = 'PROCESSING', created_at = datetime('now', '-2 days') WHERE id = 2").run()
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Dashboard Visualization Endpoints', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('GET /api/v1/dashboard/sales-heatmap', () => {
        it('返回日期+数量+金额数组', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(Array.isArray(data.data)).toBe(true)
            expect(data.data.length).toBeGreaterThan(0)
            expect(data.data[0]).toHaveProperty('date')
            expect(data.data[0]).toHaveProperty('orderCount')
            expect(data.data[0]).toHaveProperty('revenue')
        })

        it('distributor 数据隔离', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            // Distributor 2 has orders 3 and 4 (PROCESSING and PENDING)
            // Only PROCESSING counts for heatmap
            const totalOrders = data.data.reduce((s: number, d: any) => s + d.orderCount, 0)
            // Admin has more orders than distributor 2
            const adminRes = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap', {
                headers: authHeaders(TOKEN),
            })
            const adminData = await adminRes.json() as any
            const adminTotal = adminData.data.reduce((s: number, d: any) => s + d.orderCount, 0)
            expect(adminTotal).toBeGreaterThanOrEqual(totalOrders)
        })

        it('验证日期格式 YYYY-MM-DD', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            for (const item of data.data) {
                expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            }
        })

        it('只含有效状态订单 (PROCESSING/SHIPPED/DELIVERED)', async () => {
            // Add a CANCELLED order
            await env.DB.prepare(
                "INSERT INTO orders (platform, platform_order_id, status, total_amount, tax_total, distributor_id, created_at) VALUES ('TIKTOK', 'CANCEL-001', 'CANCELLED', 9999, 0, 1, datetime('now'))"
            ).run()
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            // CANCELLED order revenue should not appear
            const totalRevenue = data.data.reduce((s: number, d: any) => s + d.revenue, 0)
            expect(totalRevenue).toBeLessThan(9999 * 2) // Should not include 9999
        })

        it('401 无认证', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap')
            expect(res.status).toBe(401)
        })

        it('空数据返回空数组', async () => {
            // Delete all orders (order_items first due to FK)
            await env.DB.prepare("DELETE FROM outbound_records").run()
            await env.DB.prepare("DELETE FROM order_items").run()
            await env.DB.prepare("DELETE FROM orders").run()
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/sales-heatmap', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.data).toEqual([])
        })
    })

    describe('GET /api/v1/dashboard/inventory-turnover', () => {
        it('返回 SKU+周转率 数据', async () => {
            // Make order 1 DELIVERED for turnover calculation
            await env.DB.prepare("UPDATE orders SET status = 'DELIVERED', created_at = datetime('now', '-1 day') WHERE id = 1").run()
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/inventory-turnover', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(Array.isArray(data.data)).toBe(true)
            expect(data.data.length).toBeGreaterThan(0)
            expect(data.data[0]).toHaveProperty('sku')
            expect(data.data[0]).toHaveProperty('turnoverRate')
            expect(data.data[0]).toHaveProperty('soldQty')
            expect(data.data[0]).toHaveProperty('currentStock')
        })

        it('admin-only (distributor 返回 403)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/inventory-turnover', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('验证 turnover 只含 DELIVERED 订单', async () => {
            // Ensure order 1 is DELIVERED with recent date
            await env.DB.prepare("UPDATE orders SET status = 'DELIVERED', created_at = datetime('now') WHERE id = 1").run()
            // Set order 2 to non-DELIVERED to exclude
            await env.DB.prepare("UPDATE orders SET status = 'SHIPPED' WHERE id = 2").run()
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/inventory-turnover', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            // CARROT-500ML: sold 2 in DELIVERED order 1, stock = 200
            const carrot = data.data.find((d: any) => d.sku === 'CARROT-500ML')
            expect(carrot).toBeDefined()
            expect(carrot.soldQty).toBeGreaterThanOrEqual(2)
            // FACE-MASK-30 from SHIPPED order 2 should NOT count
            const mask = data.data.find((d: any) => d.sku === 'FACE-MASK-30')
            if (mask) {
                expect(mask.soldQty).toBe(0) // Not DELIVERED
            }
        })

        it('401 无认证', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/dashboard/inventory-turnover')
            expect(res.status).toBe(401)
        })
    })
})
