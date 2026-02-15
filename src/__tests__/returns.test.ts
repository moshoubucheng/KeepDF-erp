import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ReturnService } from '../services/return.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
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
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

// Helper: make order 1 DELIVERED with a customer
async function setupDeliveredOrder(db: D1Database) {
    await db.prepare("UPDATE orders SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP WHERE id = 1").run()
    await db.prepare(
        "INSERT INTO customers (name, email, distributor_id) VALUES ('Test Customer', 'test@example.com', 1)"
    ).run()
    await db.prepare("UPDATE orders SET customer_id = 1 WHERE id = 1").run()
}

describe('Return Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await setupDeliveredOrder(env.DB)
    })

    it('creates a return for DELIVERED order', async () => {
        const service = new ReturnService(env.DB)
        const ret = await service.create({
            orderId: 1,
            reason: 'Defective product',
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        expect(ret).toBeTruthy()
        expect(ret.status).toBe('REQUESTED')
        expect(ret.order_id).toBe(1)
        expect(ret.refund_amount).toBe(1200)
    })

    it('rejects return for non-DELIVERED order', async () => {
        const service = new ReturnService(env.DB)
        // Order 3 is PROCESSING
        await expect(service.create({
            orderId: 3,
            items: [{ sku: 'RICE-5KG', qty: 1, unit_price: 2800 }],
            distributorId: 2,
            role: 'distributor',
        })).rejects.toThrow('Only DELIVERED orders can be returned')
    })

    it('rejects duplicate active return', async () => {
        const service = new ReturnService(env.DB)
        await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        await expect(service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })).rejects.toThrow('active return already exists')
    })

    it('approve() transitions REQUESTED → APPROVED', async () => {
        const service = new ReturnService(env.DB)
        const ret = await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        const approved = await service.approve(ret.id)
        expect(approved.status).toBe('APPROVED')
    })

    it('reject() transitions REQUESTED → REJECTED', async () => {
        const service = new ReturnService(env.DB)
        const ret = await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        const rejected = await service.reject(ret.id, 'Return policy expired')
        expect(rejected.status).toBe('REJECTED')
    })

    it('receive() restocks inventory', async () => {
        const before = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()

        const service = new ReturnService(env.DB)
        const ret = await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 2, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        await service.approve(ret.id)
        const received = await service.receive(ret.id)
        expect(received.status).toBe('RECEIVED')

        const after = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()
        expect(after!.qty).toBe(before!.qty + 2)
    })

    it('refund() credits wallet and reverses commission', async () => {
        // Setup commission settlement for order 1
        await env.DB.prepare(
            `INSERT INTO commission_settlements (distributor_id, order_id, sku, platform, qty, unit_price, commission_rate, commission_amount, status, settled_at)
             VALUES (1, 1, 'CARROT-500ML', 'TIKTOK', 2, 1200, 0.05, 120, 'SETTLED', datetime('now'))`
        ).run()

        const balanceBefore = await env.DB.prepare('SELECT balance FROM distributors WHERE id = 1').first<{ balance: number }>()

        const service = new ReturnService(env.DB)
        const ret = await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 2, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        await service.approve(ret.id)
        await service.receive(ret.id)
        const refunded = await service.refund(ret.id)

        expect(refunded.status).toBe('REFUNDED')

        // Check wallet was credited
        const balanceAfter = await env.DB.prepare('SELECT balance FROM distributors WHERE id = 1').first<{ balance: number }>()
        expect(balanceAfter!.balance).toBe(balanceBefore!.balance + 2400) // 2 * 1200

        // Check negative commission settlement exists
        const { results: negComm } = await env.DB.prepare(
            "SELECT * FROM commission_settlements WHERE order_id = 1 AND commission_amount < 0"
        ).all()
        expect(negComm.length).toBe(1)
        expect((negComm[0] as any).commission_amount).toBe(-120)
    })

    it('full lifecycle: REQUESTED → APPROVED → RECEIVED → REFUNDED', async () => {
        const service = new ReturnService(env.DB)
        const ret = await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        expect(ret.status).toBe('REQUESTED')

        const approved = await service.approve(ret.id)
        expect(approved.status).toBe('APPROVED')

        const received = await service.receive(ret.id)
        expect(received.status).toBe('RECEIVED')

        const refunded = await service.refund(ret.id)
        expect(refunded.status).toBe('REFUNDED')
    })

    it('list() returns returns with data isolation', async () => {
        const service = new ReturnService(env.DB)
        await service.create({
            orderId: 1,
            items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            distributorId: 1,
            role: 'admin',
        })

        // Admin sees all
        const adminList = await service.list(1, 'admin')
        expect(adminList.returns.length).toBe(1)

        // Distributor 2 sees nothing (order belongs to dist 1)
        const dist2List = await service.list(2, 'distributor')
        expect(dist2List.returns.length).toBe(0)
    })
})

describe('Returns Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await setupDeliveredOrder(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /returns creates a return', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/returns', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: 1,
                reason: 'Broken',
                items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.return.status).toBe('REQUESTED')
    })

    it('POST /returns validates required fields', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/returns', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 1 }),
        })
        expect(res.status).toBe(400)
    })

    it('PATCH /returns/:id/approve requires admin', async () => {
        // Create return as admin
        const createRes = await SELF.fetch('http://localhost/api/v1/returns', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: 1,
                items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            }),
        })
        const { return: ret } = await createRes.json() as any

        // Non-admin attempt
        const failRes = await SELF.fetch(`http://localhost/api/v1/returns/${ret.id}/approve`, {
            method: 'PATCH',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
        })
        expect(failRes.status).toBe(403)

        // Admin succeeds
        const okRes = await SELF.fetch(`http://localhost/api/v1/returns/${ret.id}/approve`, {
            method: 'PATCH',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })
        expect(okRes.status).toBe(200)
    })

    it('GET /returns returns list', async () => {
        await SELF.fetch('http://localhost/api/v1/returns', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: 1,
                items: [{ sku: 'CARROT-500ML', qty: 1, unit_price: 1200 }],
            }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/returns', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.returns.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /returns/export returns CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/returns/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })
})
