import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CustomerSegmentService } from '../services/customer-segment.service'

const customerSegments = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /customers/rfm - Calculate RFM for all customers */
customerSegments.get('/rfm', async (c) => {
    const service = new CustomerSegmentService(c.env.DB)
    const rfmData = await service.calculateRFM(c.get('distributorId'), c.get('role'))
    return c.json({ customers: rfmData, total: rfmData.length })
})

/** GET /customers/rfm/distribution - RFM distribution stats */
customerSegments.get('/rfm/distribution', async (c) => {
    const service = new CustomerSegmentService(c.env.DB)
    const distribution = await service.getRFMDistribution(c.get('distributorId'), c.get('role'))
    return c.json(distribution)
})

/** GET /customers/segments - List segments */
customerSegments.get('/segments', async (c) => {
    const service = new CustomerSegmentService(c.env.DB)
    const segments = await service.listSegments(c.get('distributorId'), c.get('role'))
    return c.json({ segments })
})

/** POST /customers/segments - Create segment */
customerSegments.post('/segments', async (c) => {
    const body = await c.req.json()
    const service = new CustomerSegmentService(c.env.DB)
    try {
        const segment = await service.createSegment(body, c.get('distributorId'))
        return c.json(segment, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /customers/segments/:id - Update segment */
customerSegments.patch('/segments/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const service = new CustomerSegmentService(c.env.DB)
    const result = await service.updateSegment(id, body, c.get('distributorId'), c.get('role'))
    if (!result) return c.json({ error: 'Segment not found' }, 404)
    return c.json(result)
})

/** DELETE /customers/segments/:id - Delete segment */
customerSegments.delete('/segments/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new CustomerSegmentService(c.env.DB)
    const deleted = await service.deleteSegment(id, c.get('distributorId'), c.get('role'))
    if (!deleted) return c.json({ error: 'Segment not found' }, 404)
    return c.json({ success: true })
})

/** GET /customers/segments/:id/customers - Customers in segment */
customerSegments.get('/segments/:id/customers', async (c) => {
    const id = Number(c.req.param('id'))
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)
    const service = new CustomerSegmentService(c.env.DB)
    const result = await service.getSegmentCustomers(id, c.get('distributorId'), c.get('role'), limit, offset)
    if (!result) return c.json({ error: 'Segment not found' }, 404)
    return c.json(result)
})

export { customerSegments }
