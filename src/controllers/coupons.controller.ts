import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CouponService } from '../services/coupon.service'

const coupons = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /coupons/available - Available coupons for current user */
coupons.get('/available', async (c) => {
    const distributorId = c.get('distributorId')
    const platform = c.req.query('platform')

    const service = new CouponService(c.env.DB)
    const available = await service.getAvailable(distributorId, platform)
    return c.json({ coupons: available })
})

/** GET /coupons - List coupons */
coupons.get('/', async (c) => {
    const platform = c.req.query('platform')
    const is_active = c.req.query('is_active')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new CouponService(c.env.DB)
    const result = await service.list({
        platform,
        is_active: is_active !== undefined ? Number(is_active) : undefined,
        limit,
        offset,
    })
    return c.json({ coupons: result.coupons, total: result.total, count: result.coupons.length })
})

/** GET /coupons/:id - Coupon detail */
coupons.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new CouponService(c.env.DB)
    const coupon = await service.getById(id)
    if (!coupon) return c.json({ error: 'Coupon not found' }, 404)
    return c.json({ coupon })
})

/** GET /coupons/:id/usage - Usage records (admin) */
coupons.get('/:id/usage', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const service = new CouponService(c.env.DB)
    const result = await service.getUsage(id)
    return c.json(result)
})

/** POST /coupons - Create coupon (admin) */
coupons.post('/', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const body = await c.req.json()
    if (!body.name || !body.type || !body.value || !body.valid_from || !body.valid_to) {
        return c.json({ error: 'name, type, value, valid_from, and valid_to are required' }, 400)
    }

    const service = new CouponService(c.env.DB)
    try {
        const coupon = await service.create(body, c.get('distributorId'))
        return c.json({ success: true, coupon }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /coupons/:id - Update coupon (admin) */
coupons.put('/:id', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const body = await c.req.json()

    const service = new CouponService(c.env.DB)
    const coupon = await service.update(id, body)
    if (!coupon) return c.json({ error: 'Coupon not found' }, 404)
    return c.json({ success: true, coupon })
})

/** DELETE /coupons/:id - Deactivate coupon (admin) */
coupons.delete('/:id', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const service = new CouponService(c.env.DB)
    const coupon = await service.deactivate(id)
    if (!coupon) return c.json({ error: 'Coupon not found' }, 404)
    return c.json({ success: true, coupon })
})

/** POST /coupons/validate - Validate coupon */
coupons.post('/validate', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ code: string; order_total: number; platform?: string; currency?: string }>()

    if (!body.code || !body.order_total) {
        return c.json({ error: 'code and order_total are required' }, 400)
    }

    const service = new CouponService(c.env.DB)
    const result = await service.validate(body.code, {
        distributorId,
        orderTotal: body.order_total,
        platform: body.platform,
        currency: body.currency,
    })
    return c.json(result)
})

export { coupons }
