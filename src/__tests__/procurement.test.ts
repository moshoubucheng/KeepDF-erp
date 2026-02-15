import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { SupplierService } from '../services/supplier.service'
import { PurchaseOrderService } from '../services/purchase-order.service'

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

describe('Supplier Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates a supplier', async () => {
        const service = new SupplierService(env.DB)
        const supplier = await service.create({
            name: 'Test Supplier Co.',
            contact_email: 'supplier@test.com',
            lead_time_days: 14,
        })

        expect(supplier.name).toBe('Test Supplier Co.')
        expect(supplier.lead_time_days).toBe(14)
        expect(supplier.is_active).toBe(1)
    })

    it('requires supplier name', async () => {
        const service = new SupplierService(env.DB)
        await expect(service.create({ name: '' })).rejects.toThrow('required')
    })

    it('lists suppliers', async () => {
        const service = new SupplierService(env.DB)
        await service.create({ name: 'Supplier A' })
        await service.create({ name: 'Supplier B' })

        const result = await service.list()
        expect(result.suppliers.length).toBe(2)
        expect(result.total).toBe(2)
    })

    it('updates a supplier', async () => {
        const service = new SupplierService(env.DB)
        const created = await service.create({ name: 'Original' })

        const updated = await service.update(created.id, { name: 'Updated' })
        expect(updated!.name).toBe('Updated')
    })

    it('deactivates a supplier', async () => {
        const service = new SupplierService(env.DB)
        const created = await service.create({ name: 'To Deactivate' })

        const result = await service.deactivate(created.id)
        expect(result).toBe(true)

        const supplier = await service.getById(created.id)
        expect(supplier!.is_active).toBe(0)
    })
})

describe('Purchase Order Service', () => {
    let supplierId: number

    beforeEach(async () => {
        await setupDB(env.DB)
        // Create a supplier
        const supplierService = new SupplierService(env.DB)
        const supplier = await supplierService.create({ name: 'PO Test Supplier' })
        supplierId = supplier.id
    })

    it('creates a purchase order with items', async () => {
        const service = new PurchaseOrderService(env.DB)
        const po = await service.create({
            supplierId,
            items: [
                { sku: 'CARROT-500ML', qty: 100, unit_cost: 1000 },
                { sku: 'GRAPE-500ML', qty: 50, unit_cost: 1200 },
            ],
            createdBy: 1,
        })

        expect(po.po_number).toMatch(/^PO-\d{8}-\d{3}$/)
        expect(po.status).toBe('DRAFT')
        expect(po.total_amount).toBe(100 * 1000 + 50 * 1200)

        const detail = await service.getById(po.id)
        expect(detail!.items.length).toBe(2)
    })

    it('requires at least one item', async () => {
        const service = new PurchaseOrderService(env.DB)
        await expect(service.create({
            supplierId,
            items: [],
            createdBy: 1,
        })).rejects.toThrow('At least one item')
    })

    it('status transitions work correctly', async () => {
        const service = new PurchaseOrderService(env.DB)
        const po = await service.create({
            supplierId,
            items: [{ sku: 'CARROT-500ML', qty: 50, unit_cost: 1000 }],
            createdBy: 1,
        })

        const submitted = await service.updateStatus(po.id, 'SUBMITTED')
        expect(submitted.status).toBe('SUBMITTED')

        const confirmed = await service.updateStatus(po.id, 'CONFIRMED')
        expect(confirmed.status).toBe('CONFIRMED')

        const shipped = await service.updateStatus(po.id, 'SHIPPED')
        expect(shipped.status).toBe('SHIPPED')
    })

    it('rejects invalid status transitions', async () => {
        const service = new PurchaseOrderService(env.DB)
        const po = await service.create({
            supplierId,
            items: [{ sku: 'CARROT-500ML', qty: 50, unit_cost: 1000 }],
            createdBy: 1,
        })

        await expect(service.updateStatus(po.id, 'SHIPPED'))
            .rejects.toThrow('Cannot transition')
    })

    it('receive() adds inventory and creates inbound records', async () => {
        const service = new PurchaseOrderService(env.DB)
        const po = await service.create({
            supplierId,
            items: [{ sku: 'CARROT-500ML', qty: 100, unit_cost: 1000 }],
            createdBy: 1,
        })

        // Transition to SHIPPED
        await service.updateStatus(po.id, 'SUBMITTED')
        await service.updateStatus(po.id, 'CONFIRMED')
        await service.updateStatus(po.id, 'SHIPPED')

        const stockBefore = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()

        const received = await service.receive(po.id)
        expect(received.status).toBe('RECEIVED')

        const stockAfter = await env.DB.prepare("SELECT qty FROM warehouse_locations WHERE sku = 'CARROT-500ML'").first<{ qty: number }>()
        expect(stockAfter!.qty).toBe(stockBefore!.qty + 100)

        // Check inbound record
        const { results: inbound } = await env.DB.prepare(
            "SELECT * FROM inbound_records WHERE sku = 'CARROT-500ML' ORDER BY id DESC LIMIT 1"
        ).all()
        expect(inbound.length).toBe(1)
        expect((inbound[0] as any).actual_qty).toBe(100)
    })

    it('lists purchase orders', async () => {
        const service = new PurchaseOrderService(env.DB)
        await service.create({
            supplierId,
            items: [{ sku: 'CARROT-500ML', qty: 50, unit_cost: 1000 }],
            createdBy: 1,
        })

        const result = await service.list()
        expect(result.orders.length).toBe(1)
        expect(result.total).toBe(1)
    })
})

describe('Suppliers Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /suppliers creates a supplier (admin only)', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'API Supplier' }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.supplier.name).toBe('API Supplier')
    })

    it('POST /suppliers requires admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Should Fail' }),
        })
        expect(res.status).toBe(403)
    })

    it('GET /suppliers returns list', async () => {
        await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Listed Supplier' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.suppliers.length).toBeGreaterThanOrEqual(1)
    })
})

describe('Purchase Orders Controller', () => {
    let supplierId: number

    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)

        // Create supplier via API
        const res = await SELF.fetch('http://localhost/api/v1/suppliers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'PO Controller Supplier' }),
        })
        const data = await res.json() as any
        supplierId = data.supplier.id
    })

    it('POST /purchase-orders creates a PO', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/purchase-orders', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier_id: supplierId,
                items: [{ sku: 'CARROT-500ML', qty: 100, unit_cost: 1000 }],
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.order.po_number).toMatch(/^PO-/)
    })

    it('POST /purchase-orders requires admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/purchase-orders', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier_id: supplierId,
                items: [{ sku: 'CARROT-500ML', qty: 50, unit_cost: 1000 }],
            }),
        })
        expect(res.status).toBe(403)
    })

    it('GET /purchase-orders/export returns CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/purchase-orders/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })
})
