import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ShippingService } from '../services/shipping.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
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

describe('Shipping Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('create() creates shipment for PROCESSING order', async () => {
        // Order 3 is PROCESSING, belongs to dist2
        const service = new ShippingService(env.DB)
        const shipment = await service.create({
            orderId: 3,
            trackingNumber: 'JP-TEST-001',
            carrier: 'YAMATO',
            distributorId: 2,
            role: 'distributor',
        })

        expect(shipment).toBeTruthy()
        expect(shipment.tracking_number).toBe('JP-TEST-001')
        expect(shipment.carrier).toBe('YAMATO')
        expect(shipment.order_id).toBe(3)

        // Order status should be SHIPPED
        const order = await env.DB.prepare('SELECT status FROM orders WHERE id = 3').first()
        expect(order!.status).toBe('SHIPPED')
    })

    it('create() deducts warehouse stock', async () => {
        // Order 3 has item: RICE-5KG qty=2, warehouse has 200
        const before = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'RICE-5KG'").first<{ qty: number }>()
        expect(before!.qty).toBe(200)

        const service = new ShippingService(env.DB)
        await service.create({
            orderId: 3,
            trackingNumber: 'JP-TEST-002',
            carrier: 'SAGAWA',
            distributorId: 2,
            role: 'distributor',
        })

        const after = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'RICE-5KG'").first<{ qty: number }>()
        expect(after!.qty).toBe(198) // 200 - 2
    })

    it('create() creates outbound record', async () => {
        const service = new ShippingService(env.DB)
        await service.create({
            orderId: 3,
            trackingNumber: 'JP-OUT-001',
            carrier: 'JAPAN_POST',
            distributorId: 2,
            role: 'distributor',
        })

        const record = await env.DB.prepare(
            "SELECT * FROM outbound_records WHERE tracking_number = 'JP-OUT-001'"
        ).first()
        expect(record).toBeTruthy()
        expect(record!.order_id).toBe(3)
    })

    it('create() rejects non-PROCESSING order', async () => {
        // Order 4 is PENDING
        const service = new ShippingService(env.DB)
        await expect(service.create({
            orderId: 4,
            trackingNumber: 'JP-FAIL-001',
            carrier: 'YAMATO',
            distributorId: 2,
            role: 'distributor',
        })).rejects.toThrow('Only PROCESSING orders can be shipped')
    })

    it('create() rejects invalid carrier', async () => {
        const service = new ShippingService(env.DB)
        await expect(service.create({
            orderId: 3,
            trackingNumber: 'JP-FAIL-002',
            carrier: 'INVALID',
            distributorId: 2,
            role: 'distributor',
        })).rejects.toThrow('Invalid carrier')
    })

    it('create() triggers notification', async () => {
        const service = new ShippingService(env.DB)
        await service.create({
            orderId: 3,
            trackingNumber: 'JP-NOTIF-001',
            carrier: 'YAMATO',
            distributorId: 2,
            role: 'distributor',
        })

        const { results } = await env.DB.prepare(
            "SELECT * FROM notifications WHERE distributor_id = 2 AND type = 'ORDER_SHIPPED'"
        ).all()
        expect(results.length).toBe(1)
    })

    it('list() returns shipments', async () => {
        const service = new ShippingService(env.DB)
        await service.create({
            orderId: 3,
            trackingNumber: 'JP-LIST-001',
            carrier: 'YAMATO',
            distributorId: 2,
            role: 'distributor',
        })

        const result = await service.list({ distributorId: 2, role: 'distributor' })
        expect(result.shipments.length).toBe(1)
        expect(result.total).toBe(1)
    })

    it('list() data isolation for non-admin', async () => {
        const service = new ShippingService(env.DB)
        await service.create({
            orderId: 3,
            trackingNumber: 'JP-ISO-001',
            carrier: 'DHL',
            distributorId: 2,
            role: 'distributor',
        })

        // Dist1 (non-admin context) sees nothing
        const result = await service.list({ distributorId: 1, role: 'distributor' })
        expect(result.shipments.length).toBe(0)

        // Admin sees all
        const adminResult = await service.list({ distributorId: 1, role: 'admin' })
        expect(adminResult.shipments.length).toBe(1)
    })

    it('updateStatus() changes status', async () => {
        const service = new ShippingService(env.DB)
        const created = await service.create({
            orderId: 3,
            trackingNumber: 'JP-UPD-001',
            carrier: 'FEDEX',
            distributorId: 2,
            role: 'distributor',
        })

        const updated = await service.updateStatus(created.id, 'IN_TRANSIT')
        expect(updated!.status).toBe('IN_TRANSIT')
    })

    it('updateStatus() rejects invalid status', async () => {
        const service = new ShippingService(env.DB)
        const created = await service.create({
            orderId: 3,
            trackingNumber: 'JP-INV-001',
            carrier: 'YAMATO',
            distributorId: 2,
            role: 'distributor',
        })

        await expect(service.updateStatus(created.id, 'UNKNOWN'))
            .rejects.toThrow('Invalid status')
    })

    it('batchCreate() processes multiple shipments', async () => {
        // Set order 4 to PROCESSING first
        await env.DB.prepare("UPDATE orders SET status = 'PROCESSING' WHERE id = 4").run()

        const service = new ShippingService(env.DB)
        const result = await service.batchCreate(
            [
                { order_id: 3, tracking_number: 'JP-B1', carrier: 'YAMATO' },
                { order_id: 4, tracking_number: 'JP-B2', carrier: 'SAGAWA' },
            ],
            2,
            'distributor',
        )

        expect(result.success).toBe(2)
        expect(result.errors.length).toBe(0)
    })
})

describe('Shipping Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /shipping creates a shipment', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/shipping', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: 3,
                tracking_number: 'JP-CTL-001',
                carrier: 'YAMATO',
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.shipment.tracking_number).toBe('JP-CTL-001')
    })

    it('POST /shipping validates required fields', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/shipping', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 3 }),
        })
        expect(res.status).toBe(400)
    })

    it('GET /shipping returns list', async () => {
        // Create a shipment first
        await SELF.fetch('http://localhost/api/v1/shipping', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 3, tracking_number: 'JP-LST-001', carrier: 'YAMATO' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/shipping', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.shipments.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /shipping/:id returns detail', async () => {
        const createRes = await SELF.fetch('http://localhost/api/v1/shipping', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 3, tracking_number: 'JP-DTL-001', carrier: 'SAGAWA' }),
        })
        const { shipment } = await createRes.json() as any

        const res = await SELF.fetch(`http://localhost/api/v1/shipping/${shipment.id}`, {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.shipment.tracking_number).toBe('JP-DTL-001')
    })

    it('PATCH /shipping/:id/status requires admin', async () => {
        // Create as dist2
        const createRes = await SELF.fetch('http://localhost/api/v1/shipping', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 3, tracking_number: 'JP-ADM-001', carrier: 'DHL' }),
        })
        const { shipment } = await createRes.json() as any

        // Non-admin attempt
        const failRes = await SELF.fetch(`http://localhost/api/v1/shipping/${shipment.id}/status`, {
            method: 'PATCH',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'IN_TRANSIT' }),
        })
        expect(failRes.status).toBe(403)

        // Admin succeeds
        const okRes = await SELF.fetch(`http://localhost/api/v1/shipping/${shipment.id}/status`, {
            method: 'PATCH',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'IN_TRANSIT' }),
        })
        expect(okRes.status).toBe(200)
        const data = await okRes.json() as any
        expect(data.shipment.status).toBe('IN_TRANSIT')
    })

    it('GET /shipping/export returns CSV', async () => {
        await SELF.fetch('http://localhost/api/v1/shipping', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 3, tracking_number: 'JP-CSV-001', carrier: 'YAMATO' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/shipping/export', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })

    it('POST /shipping/batch creates multiple shipments', async () => {
        // Set order 4 to PROCESSING
        await env.DB.prepare("UPDATE orders SET status = 'PROCESSING' WHERE id = 4").run()

        const res = await SELF.fetch('http://localhost/api/v1/shipping/batch', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shipments: [
                    { order_id: 3, tracking_number: 'JP-BAT-001', carrier: 'YAMATO' },
                    { order_id: 4, tracking_number: 'JP-BAT-002', carrier: 'SAGAWA' },
                ],
            }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(2)
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/shipping')
        expect(res.status).toBe(401)
    })
})
