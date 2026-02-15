import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { StocktakeService } from '../services/stocktake.service'
import { adminOnly } from '../middleware/admin'

const stocktakes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /stocktakes - List stocktakes (admin) */
stocktakes.get('/', adminOnly, async (c) => {
    const service = new StocktakeService(c.env.DB)
    const result = await service.list({
        status: c.req.query('status') || undefined,
        limit: Number(c.req.query('limit') || 50),
        offset: Number(c.req.query('offset') || 0),
    })
    return c.json(result)
})

/** POST /stocktakes - Create stocktake (admin) */
stocktakes.post('/', adminOnly, async (c) => {
    const body = await c.req.json<{ notes?: string }>().catch(() => ({ notes: undefined }))
    const service = new StocktakeService(c.env.DB)
    const result = await service.create(c.get('distributorId'), body.notes)
    return c.json(result, 201)
})

/** GET /stocktakes/:id - Stocktake detail (admin) */
stocktakes.get('/:id', adminOnly, async (c) => {
    const service = new StocktakeService(c.env.DB)
    const result = await service.getDetail(Number(c.req.param('id')))
    if (!result) return c.json({ error: 'Stocktake not found' }, 404)
    return c.json(result)
})

/** POST /stocktakes/:id/start - Start stocktake (admin) */
stocktakes.post('/:id/start', adminOnly, async (c) => {
    const service = new StocktakeService(c.env.DB)
    try {
        const result = await service.start(Number(c.req.param('id')), c.get('distributorId'))
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /stocktakes/:id/items - Count item (admin) */
stocktakes.patch('/:id/items', adminOnly, async (c) => {
    const body = await c.req.json<{ sku: string; location_code: string; actual_qty: number; notes?: string }>()
    if (!body.sku || !body.location_code || body.actual_qty === undefined) {
        return c.json({ error: 'sku, location_code, and actual_qty are required' }, 400)
    }
    const service = new StocktakeService(c.env.DB)
    try {
        const result = await service.countItem(
            Number(c.req.param('id')),
            body.sku, body.location_code, body.actual_qty, body.notes
        )
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /stocktakes/:id/complete - Complete stocktake (admin) */
stocktakes.post('/:id/complete', adminOnly, async (c) => {
    const service = new StocktakeService(c.env.DB)
    try {
        const result = await service.complete(Number(c.req.param('id')), c.get('distributorId'))
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /stocktakes/:id/cancel - Cancel stocktake (admin) */
stocktakes.post('/:id/cancel', adminOnly, async (c) => {
    const service = new StocktakeService(c.env.DB)
    try {
        const result = await service.cancel(Number(c.req.param('id')), c.get('distributorId'))
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

export { stocktakes }
