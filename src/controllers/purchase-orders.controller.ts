import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { PurchaseOrderService } from '../services/purchase-order.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const purchaseOrders = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /purchase-orders/export - CSV export (admin only) */
purchaseOrders.get('/export', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new PurchaseOrderService(c.env.DB)
    const { orders } = await service.list({ limit: 5000 })

    const csv = toCSV(orders as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'po_number', header: 'PO番号' },
        { key: 'supplier_name', header: '仕入先' },
        { key: 'status', header: 'ステータス' },
        { key: 'total_amount', header: '合計金額' },
        { key: 'expected_delivery', header: '納期' },
        { key: 'created_at', header: '作成日' },
    ])

    return csvResponse(csv, 'purchase-orders.csv')
})

/** GET /purchase-orders - List POs (admin only) */
purchaseOrders.get('/', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const status = c.req.query('status')
    const supplierId = c.req.query('supplier_id')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new PurchaseOrderService(c.env.DB)
    const result = await service.list({
        status: status || undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        limit, offset,
    })

    return c.json({ orders: result.orders, total: result.total })
})

/** GET /purchase-orders/:id - PO detail (admin only) */
purchaseOrders.get('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new PurchaseOrderService(c.env.DB)
    const result = await service.getById(Number(c.req.param('id')))

    if (!result) return c.json({ error: 'Purchase order not found' }, 404)
    return c.json(result)
})

/** POST /purchase-orders - Create PO (admin only) */
purchaseOrders.post('/', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json<{
        supplier_id: number
        items: { sku: string; qty: number; unit_cost: number }[]
        notes?: string
        expected_delivery?: string
    }>()

    if (!body.supplier_id || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'supplier_id and non-empty items array are required' }, 400)
    }

    for (const item of body.items) {
        if (!item.sku || typeof item.qty !== 'number' || item.qty <= 0 || item.qty > 1000000) {
            return c.json({ error: 'Each item must have sku, qty > 0 (max 1,000,000)' }, 400)
        }
        if (typeof item.unit_cost !== 'number' || item.unit_cost <= 0 || item.unit_cost > 100000000) {
            return c.json({ error: 'Each item must have unit_cost > 0 (max 100,000,000)' }, 400)
        }
    }

    const service = new PurchaseOrderService(c.env.DB)
    try {
        const po = await service.create({
            supplierId: body.supplier_id,
            items: body.items,
            notes: body.notes,
            expectedDelivery: body.expected_delivery,
            createdBy: c.get('distributorId'),
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_PO',
            resourceType: 'purchase_order',
            resourceId: po.po_number,
            details: `supplier=${body.supplier_id}, items=${body.items.length}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, order: po }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /purchase-orders/:id - Update PO (admin only) */
purchaseOrders.put('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json()
    const service = new PurchaseOrderService(c.env.DB)

    try {
        const po = await service.update(Number(c.req.param('id')), body)
        if (!po) return c.json({ error: 'Purchase order not found' }, 404)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'UPDATE_PO',
            resourceType: 'purchase_order',
            resourceId: String(po.id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, order: po })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /purchase-orders/:id/status - Update status (admin only) */
purchaseOrders.patch('/:id/status', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json<{ status: string }>()
    if (!body.status) return c.json({ error: 'status is required' }, 400)

    const service = new PurchaseOrderService(c.env.DB)
    try {
        const po = await service.updateStatus(Number(c.req.param('id')), body.status)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'UPDATE_PO',
            resourceType: 'purchase_order',
            resourceId: String(po.id),
            details: `status=${body.status}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, order: po })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /purchase-orders/:id/receive - Receive PO (admin only) */
purchaseOrders.post('/:id/receive', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json<{
        items?: { sku: string; received_qty: number }[]
    }>()

    const service = new PurchaseOrderService(c.env.DB)
    try {
        const po = await service.receive(Number(c.req.param('id')), body.items)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'RECEIVE_PO',
            resourceType: 'purchase_order',
            resourceId: String(po.id),
            details: `po=${po.po_number}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, order: po })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

export { purchaseOrders }
