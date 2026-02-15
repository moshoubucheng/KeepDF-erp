import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ShippingService } from '../services/shipping.service'
import { ShipmentTrackingService } from '../services/shipment-tracking.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const shipping = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /shipping/export - CSV export */
shipping.get('/export', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new ShippingService(c.env.DB)
    const { shipments } = await service.list({ distributorId, role, limit: 5000 })

    const csv = toCSV(shipments as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'order_id', header: '\u6CE8\u6587ID' },
        { key: 'tracking_number', header: '\u8FFD\u8DE1\u756A\u53F7' },
        { key: 'carrier', header: '\u904B\u9001\u4F1A\u793E' },
        { key: 'status', header: '\u30B9\u30C6\u30FC\u30BF\u30B9' },
        { key: 'platform', header: '\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0' },
        { key: 'shipped_at', header: '\u767A\u9001\u65E5' },
    ])

    return csvResponse(csv, 'shipments.csv')
})

/** GET /shipping - List shipments */
shipping.get('/', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')
    const status = c.req.query('status')
    const carrier = c.req.query('carrier')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new ShippingService(c.env.DB)
    const result = await service.list({ distributorId, role, status, carrier, limit, offset })

    return c.json({
        shipments: result.shipments,
        total: result.total,
        count: result.shipments.length,
    })
})

/** GET /shipping/:id - Shipment detail */
shipping.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new ShippingService(c.env.DB)
    const shipment = await service.getDetail(id, distributorId, role)

    if (!shipment) return c.json({ error: 'Shipment not found' }, 404)
    return c.json({ shipment })
})

/** POST /shipping - Create shipment */
shipping.post('/', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')
    const body = await c.req.json<{
        order_id: number
        tracking_number: string
        carrier: string
        estimated_delivery?: string
    }>()

    if (!body.order_id || !body.tracking_number || !body.carrier) {
        return c.json({ error: 'order_id, tracking_number, and carrier are required' }, 400)
    }

    const service = new ShippingService(c.env.DB)
    try {
        const shipment = await service.create({
            orderId: body.order_id,
            trackingNumber: body.tracking_number,
            carrier: body.carrier.toUpperCase(),
            estimatedDelivery: body.estimated_delivery,
            distributorId,
            role,
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId,
            action: 'CREATE_SHIPMENT',
            resourceType: 'shipment',
            resourceId: String(shipment.id),
            details: `order=${body.order_id}, tracking=${body.tracking_number}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, shipment }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /shipping/batch - Batch create shipments */
shipping.post('/batch', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')
    const body = await c.req.json<{
        shipments: { order_id: number; tracking_number: string; carrier: string }[]
    }>()

    if (!body.shipments || !Array.isArray(body.shipments) || body.shipments.length === 0) {
        return c.json({ error: 'shipments array is required' }, 400)
    }

    if (body.shipments.length > 100) {
        return c.json({ error: 'Maximum 100 shipments per batch' }, 400)
    }

    const service = new ShippingService(c.env.DB)
    const result = await service.batchCreate(body.shipments, distributorId, role)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'BATCH_SHIPMENT',
        resourceType: 'shipment',
        details: `success=${result.success}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

/** PATCH /shipping/:id/status - Update shipment status */
shipping.patch('/:id/status', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ status: string }>()

    if (!body.status) {
        return c.json({ error: 'status is required' }, 400)
    }

    const service = new ShippingService(c.env.DB)
    try {
        const shipment = await service.updateStatus(id, body.status.toUpperCase())
        if (!shipment) return c.json({ error: 'Shipment not found' }, 404)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'UPDATE_SHIPMENT_STATUS',
            resourceType: 'shipment',
            resourceId: String(id),
            details: `status=${body.status}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, shipment })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** GET /shipping/:id/events - Get shipment events timeline */
shipping.get('/:id/events', async (c) => {
    const id = Number(c.req.param('id'))
    const trackingService = new ShipmentTrackingService(c.env.DB)
    const events = await trackingService.getEvents(id)
    return c.json({ events })
})

/** POST /shipping/:id/events - Add tracking event (admin) */
shipping.post('/:id/events', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ status: string; location?: string; description?: string }>()

    if (!body.status) {
        return c.json({ error: 'status is required' }, 400)
    }

    const trackingService = new ShipmentTrackingService(c.env.DB)
    try {
        const event = await trackingService.addEvent(id, body.status, body.location, body.description)
        return c.json({ success: true, event }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** GET /shipping/:id/tracking-url - Get tracking URL */
shipping.get('/:id/tracking-url', async (c) => {
    const id = Number(c.req.param('id'))
    const shipment = await c.env.DB.prepare('SELECT carrier, tracking_number FROM shipments WHERE id = ?').bind(id).first()
    if (!shipment) return c.json({ error: 'Shipment not found' }, 404)

    const trackingService = new ShipmentTrackingService(c.env.DB)
    const url = trackingService.getTrackingUrl(shipment.carrier as string, shipment.tracking_number as string)
    return c.json({ tracking_url: url })
})

/** GET /shipping/:id/timeline - Full timeline with tracking URL and duration */
shipping.get('/:id/timeline', async (c) => {
    const id = Number(c.req.param('id'))
    const trackingService = new ShipmentTrackingService(c.env.DB)
    try {
        const timeline = await trackingService.getTimeline(id)
        return c.json(timeline)
    } catch (e: any) {
        return c.json({ error: e.message }, 404)
    }
})

export { shipping }
