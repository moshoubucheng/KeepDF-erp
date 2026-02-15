import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { BatchService } from '../services/batch.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'automation_logs', 'automation_rules',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
    'purchase_order_items', 'purchase_orders', 'suppliers',
    'price_rules', 'price_history',
    'message_templates', 'customer_messages', 'message_triggers',
    'inventory_forecasts',
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

describe('Batch Service - Order Status', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('batchOrderStatus() updates multiple orders', async () => {
        // Orders 4,5 are PENDING
        const service = new BatchService(env.DB)
        const result = await service.batchOrderStatus([4, 5], 'PROCESSING', 1, 'admin')
        expect(result.success).toBe(2)
        expect(result.errors.length).toBe(0)

        // Verify status changed
        const order4 = await env.DB.prepare('SELECT status FROM orders WHERE id = 4').first<{ status: string }>()
        expect(order4!.status).toBe('PROCESSING')
    })

    it('batchOrderStatus() rejects invalid state transitions', async () => {
        // Order 1 is DELIVERED, cannot go to PROCESSING
        const service = new BatchService(env.DB)
        const result = await service.batchOrderStatus([1], 'PROCESSING', 1, 'admin')
        expect(result.success).toBe(0)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].error).toContain('Cannot transition')
    })

    it('batchOrderStatus() reports not found orders', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchOrderStatus([999], 'PROCESSING', 1, 'admin')
        expect(result.success).toBe(0)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].error).toBe('Order not found')
    })

    it('batchOrderStatus() sets delivered_at for DELIVERED', async () => {
        // Order 2 is SHIPPED, transition to DELIVERED
        const service = new BatchService(env.DB)
        const result = await service.batchOrderStatus([2], 'DELIVERED', 1, 'admin')
        expect(result.success).toBe(1)

        const order = await env.DB.prepare('SELECT status, delivered_at FROM orders WHERE id = 2').first()
        expect((order as any).status).toBe('DELIVERED')
        expect((order as any).delivered_at).toBeTruthy()
    })

    it('batchOrderStatus() sets cancelled_at for CANCELLED', async () => {
        // Order 4 is PENDING, transition to CANCELLED
        const service = new BatchService(env.DB)
        const result = await service.batchOrderStatus([4], 'CANCELLED', 2, 'admin')
        expect(result.success).toBe(1)

        const order = await env.DB.prepare('SELECT status, cancelled_at FROM orders WHERE id = 4').first()
        expect((order as any).status).toBe('CANCELLED')
        expect((order as any).cancelled_at).toBeTruthy()
    })

    it('batchOrderStatus() rejects invalid target status', async () => {
        const service = new BatchService(env.DB)
        await expect(
            service.batchOrderStatus([4], 'INVALID', 1, 'admin')
        ).rejects.toThrow('Invalid target status')
    })

    it('batchOrderStatus() enforces distributor isolation for non-admin', async () => {
        // Order 4 belongs to distributor 2, try as distributor 1
        const service = new BatchService(env.DB)
        const result = await service.batchOrderStatus([4], 'PROCESSING', 1, 'distributor')
        expect(result.success).toBe(0)
        expect(result.errors[0].error).toBe('Order not found')
    })
})

describe('Batch Service - Product Update', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('batchProductUpdate() updates multiple products', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchProductUpdate([
            { id: 1, cost_price: 1500 },
            { id: 2, name_jp: 'ぶどうジュース改' },
        ])
        expect(result.success).toBe(2)
        expect(result.errors.length).toBe(0)

        const p1 = await env.DB.prepare('SELECT cost_price FROM products WHERE id = 1').first<{ cost_price: number }>()
        expect(p1!.cost_price).toBe(1500)

        const p2 = await env.DB.prepare('SELECT name_jp FROM products WHERE id = 2').first<{ name_jp: string }>()
        expect(p2!.name_jp).toBe('ぶどうジュース改')
    })

    it('batchProductUpdate() rejects not found products', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchProductUpdate([
            { id: 999, cost_price: 100 },
        ])
        expect(result.success).toBe(0)
        expect(result.errors[0].error).toBe('Product not found')
    })

    it('batchProductUpdate() rejects cost_price <= 0', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchProductUpdate([
            { id: 1, cost_price: -100 },
        ])
        expect(result.success).toBe(0)
        expect(result.errors[0].error).toBe('cost_price must be positive')
    })
})

describe('Batch Service - Stock Adjust', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('batchStockAdjust() increases stock', async () => {
        const before = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()
        expect(before!.qty).toBe(500)

        const service = new BatchService(env.DB)
        const result = await service.batchStockAdjust([
            { sku: 'CARROT-500ML', qty: 100, reason: 'Restock' },
        ])
        expect(result.success).toBe(1)

        const after = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()
        expect(after!.qty).toBe(600)
    })

    it('batchStockAdjust() decreases stock', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchStockAdjust([
            { sku: 'CARROT-500ML', qty: -50, reason: 'Damage' },
        ])
        expect(result.success).toBe(1)

        const after = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()
        expect(after!.qty).toBe(450)
    })

    it('batchStockAdjust() rejects negative result', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchStockAdjust([
            { sku: 'CARROT-500ML', qty: -9999, reason: 'Too much' },
        ])
        expect(result.success).toBe(0)
        expect(result.errors[0].error).toContain('Insufficient stock')
    })

    it('batchStockAdjust() requires reason', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchStockAdjust([
            { sku: 'CARROT-500ML', qty: 10, reason: '' },
        ])
        expect(result.success).toBe(0)
        expect(result.errors[0].error).toBe('Reason is required')
    })

    it('batchStockAdjust() creates inbound records for positive adjustments', async () => {
        const service = new BatchService(env.DB)
        await service.batchStockAdjust([
            { sku: 'CARROT-500ML', qty: 50, reason: 'Received' },
        ])

        const inbound = await env.DB.prepare(
            "SELECT * FROM inbound_records WHERE sku = 'CARROT-500ML' ORDER BY id DESC LIMIT 1"
        ).first()
        expect(inbound).toBeTruthy()
        expect((inbound as any).expected_qty).toBe(50)
        expect((inbound as any).actual_qty).toBe(50)
    })

    it('batchStockAdjust() reports unknown SKU', async () => {
        const service = new BatchService(env.DB)
        const result = await service.batchStockAdjust([
            { sku: 'NONEXISTENT', qty: 10, reason: 'Test' },
        ])
        expect(result.success).toBe(0)
        expect(result.errors[0].error).toBe('SKU not found in warehouse')
    })
})

describe('Batch Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('POST /batch/orders/status rejects non-admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/batch/orders/status', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: [4], status: 'PROCESSING' }),
        })
        expect(res.status).toBe(403)
    })

    it('POST /batch/orders/status validates body', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/batch/orders/status', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })
        expect(res.status).toBe(400)
    })

    it('POST /batch/orders/status enforces max 100', async () => {
        const ids = Array.from({ length: 101 }, (_, i) => i + 1)
        const res = await SELF.fetch('http://localhost/api/v1/batch/orders/status', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: ids, status: 'PROCESSING' }),
        })
        expect(res.status).toBe(400)
        const data = await res.json() as any
        expect(data.error).toContain('Maximum 100')
    })

    it('POST /batch/orders/status works for admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/batch/orders/status', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: [4, 5], status: 'PROCESSING' }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(2)
    })

    it('POST /batch/products/update works for admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/batch/products/update', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: [{ id: 1, cost_price: 1800 }] }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(1)
    })

    it('POST /batch/stock/adjust works for admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/batch/stock/adjust', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adjustments: [{ sku: 'CARROT-500ML', qty: 50, reason: 'Restock' }],
            }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(1)
    })

    it('POST /batch/stock/adjust creates audit log', async () => {
        await SELF.fetch('http://localhost/api/v1/batch/stock/adjust', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adjustments: [{ sku: 'CARROT-500ML', qty: 10, reason: 'Test' }],
            }),
        })

        const audit = await env.DB.prepare(
            "SELECT * FROM audit_logs WHERE action = 'BATCH_STOCK_ADJUST' ORDER BY id DESC LIMIT 1"
        ).first()
        expect(audit).toBeTruthy()
    })
})
