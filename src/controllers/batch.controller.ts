import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { BatchService } from '../services/batch.service'
import { AuditService } from '../services/audit.service'

const batch = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All batch endpoints are admin-only
const adminGuard = async (c: any, next: () => Promise<void>) => {
    if (c.get('role') !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }
    await next()
}

batch.use('/*', adminGuard)

/** POST /batch/orders/status - Batch update order status */
batch.post('/orders/status', async (c) => {
    const body = await c.req.json<{
        order_ids: number[]
        status: string
    }>()

    if (!body.order_ids || !Array.isArray(body.order_ids) || body.order_ids.length === 0) {
        return c.json({ error: 'order_ids array is required' }, 400)
    }
    if (!body.status) {
        return c.json({ error: 'status is required' }, 400)
    }
    if (body.order_ids.length > 100) {
        return c.json({ error: 'Maximum 100 orders per batch' }, 400)
    }

    const service = new BatchService(c.env.DB)
    try {
        const result = await service.batchOrderStatus(
            body.order_ids,
            body.status.toUpperCase(),
            c.get('distributorId'),
            c.get('role'),
        )

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'BATCH_ORDER_STATUS',
            resourceType: 'batch_operation',
            details: `target_status=${body.status}, success=${result.success}, errors=${result.errors.length}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /batch/products/update - Batch update products */
batch.post('/products/update', async (c) => {
    const body = await c.req.json<{
        updates: { id: number; cost_price?: number; name_jp?: string; name_cn?: string }[]
    }>()

    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
        return c.json({ error: 'updates array is required' }, 400)
    }
    if (body.updates.length > 100) {
        return c.json({ error: 'Maximum 100 products per batch' }, 400)
    }

    const service = new BatchService(c.env.DB)
    const result = await service.batchProductUpdate(body.updates)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'BATCH_PRODUCT_UPDATE',
        resourceType: 'batch_operation',
        details: `success=${result.success}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

/** POST /batch/stock/adjust - Batch stock adjustment */
batch.post('/stock/adjust', async (c) => {
    const body = await c.req.json<{
        adjustments: { sku: string; qty: number; reason: string }[]
    }>()

    if (!body.adjustments || !Array.isArray(body.adjustments) || body.adjustments.length === 0) {
        return c.json({ error: 'adjustments array is required' }, 400)
    }
    if (body.adjustments.length > 100) {
        return c.json({ error: 'Maximum 100 adjustments per batch' }, 400)
    }

    const service = new BatchService(c.env.DB)
    const result = await service.batchStockAdjust(body.adjustments)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'BATCH_STOCK_ADJUST',
        resourceType: 'batch_operation',
        details: `success=${result.success}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

export { batch }
