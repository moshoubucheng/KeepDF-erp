import { Hono } from 'hono'
import type { Bindings, Variables, CommissionSettlement } from '../db/types'
import { CommissionService } from '../services/commission.service'
import { getAuthorizedOrder } from '../utils/auth-helpers'
import { toCSV, csvResponse } from '../utils/csv'

const commissions = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /commissions/export - CSV 导出 */
commissions.get('/export', async (c) => {
    const distributorId = c.get('distributorId')

    const { results } = await c.env.DB.prepare(
        'SELECT * FROM commission_settlements WHERE distributor_id = ? ORDER BY created_at DESC LIMIT 5000'
    ).bind(distributorId).all<CommissionSettlement>()

    const csv = toCSV(results as unknown as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'order_id', header: '注文ID' },
        { key: 'sku', header: 'SKU' },
        { key: 'platform', header: 'プラットフォーム' },
        { key: 'qty', header: '数量' },
        { key: 'unit_price', header: '単価' },
        { key: 'commission_rate', header: '手数料率' },
        { key: 'commission_amount', header: '手数料' },
        { key: 'status', header: 'ステータス' },
        { key: 'created_at', header: '日時' },
    ])

    return csvResponse(csv, 'commissions.csv')
})

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

    const authResult = await getAuthorizedOrder(c.env.DB, orderId, distributorId)
    if ('error' in authResult) return c.json({ error: authResult.error }, authResult.status)
    const { order } = authResult

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

const VALID_COMMISSION_STATUSES = ['PENDING', 'SETTLED', 'FAILED'] as const

/** GET /commissions/history - 结算历史 */
commissions.get('/history', async (c) => {
    const distributorId = c.get('distributorId')
    const status = c.req.query('status')
    const cursor = c.req.query('cursor')
    const rawLimit = Number(c.req.query('limit') || 50)
    const rawOffset = Number(c.req.query('offset') || 0)

    const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200))
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset)

    if (status && !VALID_COMMISSION_STATUSES.includes(status.toUpperCase() as typeof VALID_COMMISSION_STATUSES[number])) {
        return c.json({ error: 'Invalid status. Must be one of: PENDING, SETTLED, FAILED' }, 400)
    }

    const service = new CommissionService(c.env.DB)
    const result = await service.getHistory(distributorId, {
        status: status ? status.toUpperCase() : undefined,
        limit,
        offset,
        cursor: cursor || undefined,
    })

    return c.json({
        settlements: result.settlements,
        total: result.total,
        count: result.settlements.length,
        hasMore: result.hasMore ?? (offset + result.settlements.length < result.total),
        ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    })
})

export { commissions }
