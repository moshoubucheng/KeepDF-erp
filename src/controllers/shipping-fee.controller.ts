import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ShippingFeeService } from '../services/shipping-fee.service'
import { adminOnly } from '../middleware/admin'

const shippingFees = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /shipping-fees/templates - List templates */
shippingFees.get('/templates', async (c) => {
    const service = new ShippingFeeService(c.env.DB)
    const result = await service.listTemplates({
        carrier: c.req.query('carrier') || undefined,
        region: c.req.query('region') || undefined,
        platform: c.req.query('platform') || undefined,
    })
    return c.json(result)
})

/** POST /shipping-fees/templates - Create template (admin) */
shippingFees.post('/templates', adminOnly, async (c) => {
    const body = await c.req.json()
    const service = new ShippingFeeService(c.env.DB)
    try {
        const template = await service.createTemplate(body, c.get('distributorId'))
        return c.json(template, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /shipping-fees/templates/:id - Update template (admin) */
shippingFees.patch('/templates/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const service = new ShippingFeeService(c.env.DB)
    const result = await service.updateTemplate(id, body, c.get('distributorId'))
    if (!result) return c.json({ error: 'Template not found' }, 404)
    return c.json(result)
})

/** DELETE /shipping-fees/templates/:id - Soft delete template (admin) */
shippingFees.delete('/templates/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const service = new ShippingFeeService(c.env.DB)
    const deleted = await service.deleteTemplate(id, c.get('distributorId'))
    if (!deleted) return c.json({ error: 'Template not found' }, 404)
    return c.json({ success: true })
})

/** GET /shipping-fees/orders/:orderId - Get fees for an order */
shippingFees.get('/orders/:orderId', async (c) => {
    const orderId = Number(c.req.param('orderId'))
    const service = new ShippingFeeService(c.env.DB)
    const fees = await service.getOrderFees(orderId, c.get('distributorId'), c.get('role'))
    return c.json({ fees })
})

/** POST /shipping-fees - Record actual fee */
shippingFees.post('/', async (c) => {
    const body = await c.req.json<{ order_id: number; carrier: string; tracking_number?: string; actual_fee: number; estimated_fee?: number; weight_g?: number; template_id?: number }>()
    if (!body.order_id) return c.json({ error: 'order_id is required' }, 400)
    const service = new ShippingFeeService(c.env.DB)
    try {
        const fee = await service.recordFee(body.order_id, body, c.get('distributorId'))
        return c.json(fee, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /shipping-fees/reconcile - Batch reconcile (admin) */
shippingFees.post('/reconcile', adminOnly, async (c) => {
    const body = await c.req.json<{ ids: number[] }>()
    if (!body.ids?.length) return c.json({ error: 'ids array is required' }, 400)
    const service = new ShippingFeeService(c.env.DB)
    const result = await service.reconcile(body.ids, c.get('distributorId'))
    return c.json(result)
})

/** GET /shipping-fees/report - Reconciliation report (admin) */
shippingFees.get('/report', adminOnly, async (c) => {
    const service = new ShippingFeeService(c.env.DB)
    const result = await service.getReconciliationReport({
        platform: c.req.query('platform') || undefined,
        startDate: c.req.query('startDate') || undefined,
        endDate: c.req.query('endDate') || undefined,
    })
    return c.json(result)
})

export { shippingFees }
