import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CommissionService } from '../services/commission.service'

const commissions = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /commissions/rates - 佣金费率表 */
commissions.get('/rates', async (c) => {
    const platform = c.req.query('platform')
    const sku = c.req.query('sku')

    const service = new CommissionService(c.env.DB)
    const rates = await service.getRates({ platform: platform || undefined, sku: sku || undefined })

    return c.json({ rates, count: rates.length })
})

/** GET /commissions/calculate/:orderId - 计算订单佣金 */
commissions.get('/calculate/:orderId', async (c) => {
    const orderId = Number(c.req.param('orderId'))
    const distributorId = c.get('distributorId')

    const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(orderId).first<any>()

    if (!order) return c.json({ error: 'Order not found' }, 404)
    if (order.distributor_id !== distributorId) {
        return c.json({ error: 'Order does not belong to you' }, 403)
    }

    const service = new CommissionService(c.env.DB)
    const result = await service.calculateOrderCommission(orderId, order.platform)

    return c.json({
        orderId,
        platform: order.platform,
        items: result.items,
        totalCommission: result.totalCommission,
        order: {
            id: order.id,
            platform: order.platform,
            total_amount: order.total_amount,
            status: order.status,
        },
    })
})

/** POST /commissions/settle - 批量结算 */
commissions.post('/settle', async (c) => {
    const body = await c.req.json<{ orderIds: number[] }>()
    const distributorId = c.get('distributorId')

    if (!body.orderIds || !Array.isArray(body.orderIds) || body.orderIds.length === 0) {
        return c.json({ error: 'orderIds is required and must be a non-empty array' }, 400)
    }

    const service = new CommissionService(c.env.DB)
    try {
        const result = await service.settleCommissions(distributorId, body.orderIds)
        return c.json({ success: true, ...result })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** GET /commissions/history - 结算历史 */
commissions.get('/history', async (c) => {
    const distributorId = c.get('distributorId')
    const status = c.req.query('status')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new CommissionService(c.env.DB)
    const { settlements, total } = await service.getHistory(distributorId, {
        status: status || undefined,
        limit,
        offset,
    })

    return c.json({
        settlements,
        total,
        count: settlements.length,
        hasMore: offset + settlements.length < total,
    })
})

export { commissions }
