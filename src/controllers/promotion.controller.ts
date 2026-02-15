import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { PromotionService } from '../services/promotion.service'
import { adminOnly } from '../middleware/admin'

const promotions = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /promotions - List promotions */
promotions.get('/', async (c) => {
    const service = new PromotionService(c.env.DB)
    const result = await service.list(c.get('distributorId'), c.get('role'), {
        status: c.req.query('status') || undefined,
        limit: Number(c.req.query('limit') || 50),
        offset: Number(c.req.query('offset') || 0),
    })
    return c.json(result)
})

/** POST /promotions - Create promotion (admin) */
promotions.post('/', adminOnly, async (c) => {
    const body = await c.req.json()
    const service = new PromotionService(c.env.DB)
    try {
        const promo = await service.create(body, c.get('distributorId'))
        return c.json(promo, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /promotions/:id - Update promotion (admin) */
promotions.patch('/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const service = new PromotionService(c.env.DB)
    const result = await service.update(id, body)
    if (!result) return c.json({ error: 'Promotion not found' }, 404)
    return c.json(result)
})

/** DELETE /promotions/:id - Delete promotion (admin) */
promotions.delete('/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const service = new PromotionService(c.env.DB)
    try {
        const deleted = await service.delete(id)
        if (!deleted) return c.json({ error: 'Promotion not found' }, 404)
        return c.json({ success: true })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** GET /promotions/applicable/:orderId - Get applicable promotions */
promotions.get('/applicable/:orderId', async (c) => {
    const orderId = Number(c.req.param('orderId'))
    const service = new PromotionService(c.env.DB)
    const applicable = await service.getApplicable(orderId, c.get('distributorId'))
    return c.json({ promotions: applicable })
})

/** POST /promotions/apply/:orderId - Apply best promotion */
promotions.post('/apply/:orderId', async (c) => {
    const orderId = Number(c.req.param('orderId'))
    const service = new PromotionService(c.env.DB)
    const result = await service.applyBest(orderId, c.get('distributorId'))
    if (!result) return c.json({ message: 'No applicable promotions' })
    return c.json(result)
})

export { promotions }
