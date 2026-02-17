import { Hono } from 'hono'
import type { Bindings, Variables, Order } from '../db/types'
import { NotificationService } from '../services/notification.service'
import { AuditService } from '../services/audit.service'
import { WalletService } from '../services/wallet.service'
import { CommissionService } from '../services/commission.service'
import { getAuthorizedOrder } from '../utils/auth-helpers'
import { NotificationCenterService } from '../services/notification-center.service'
import { CommunicationService } from '../services/communication.service'
import { CacheService } from '../services/cache.service'
import { AutomationService } from '../services/automation.service'
import { decodeCursor, buildCursorWhere, encodeCursor } from '../utils/cursor'
import { toCSV, csvResponse } from '../utils/csv'

const orders = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const VALID_PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const
const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const

/** GET /orders/export - CSV 导出 */
orders.get('/export', async (c) => {
    const distributorId = c.get('distributorId')
    const platform = c.req.query('platform')
    const status = c.req.query('status')

    let sql = 'SELECT * FROM orders WHERE distributor_id = ?'
    const params: (string | number)[] = [distributorId]

    if (platform) {
        sql += ' AND platform = ?'
        params.push(platform.toUpperCase())
    }
    if (status) {
        sql += ' AND status = ?'
        params.push(status.toUpperCase())
    }

    sql += ' ORDER BY created_at DESC LIMIT 5000'

    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Order>()

    const csv = toCSV(results as unknown as Record<string, unknown>[], [
        { key: 'id', header: '注文ID' },
        { key: 'platform', header: 'プラットフォーム' },
        { key: 'platform_order_id', header: '注文番号' },
        { key: 'status', header: 'ステータス' },
        { key: 'total_amount', header: '金額' },
        { key: 'tax_total', header: '税額' },
        { key: 'created_at', header: '日時' },
    ])

    return csvResponse(csv, 'orders.csv')
})

/** GET /orders - 订单列表 */
orders.get('/', async (c) => {
    const distributorId = c.get('distributorId')
    const platform = c.req.query('platform')
    const status = c.req.query('status')
    const cursor = c.req.query('cursor')
    const rawLimit = Number(c.req.query('limit') || 50)
    const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200))

    if (platform && !VALID_PLATFORMS.includes(platform.toUpperCase() as typeof VALID_PLATFORMS[number])) {
        return c.json({ error: 'Invalid platform. Must be one of: TIKTOK, TEMU, RAKUTEN' }, 400)
    }
    if (status && !VALID_STATUSES.includes(status.toUpperCase() as typeof VALID_STATUSES[number])) {
        return c.json({ error: 'Invalid status. Must be one of: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED' }, 400)
    }

    let where = 'WHERE distributor_id = ?'
    const baseParams: (string | number)[] = [distributorId]

    if (platform) {
        where += ' AND platform = ?'
        baseParams.push(platform.toUpperCase())
    }
    if (status) {
        where += ' AND status = ?'
        baseParams.push(status.toUpperCase())
    }

    // Cursor-based pagination
    if (cursor) {
        const decoded = decodeCursor(cursor)
        if (decoded) {
            const { clause, binds } = buildCursorWhere(decoded)
            const cursorWhere = `${where} AND ${clause}`
            const sql = `SELECT * FROM orders ${cursorWhere} ORDER BY created_at DESC, id DESC LIMIT ?`
            const { results } = await c.env.DB.prepare(sql).bind(...baseParams, ...binds, limit + 1).all<Order>()

            const hasMore = results.length > limit
            const page = hasMore ? results.slice(0, limit) : results
            const nextCursor = hasMore && page.length > 0
                ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
                : undefined

            return c.json({ orders: page, count: page.length, hasMore, ...(nextCursor ? { nextCursor } : {}) })
        }
    }

    // Offset-based fallback
    const sql = `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ?`
    const { results } = await c.env.DB.prepare(sql).bind(...baseParams, limit).all<Order>()

    return c.json({ orders: results, count: results.length })
})

/** GET /orders/:id - 订单详情（含 items） */
orders.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    const result = await getAuthorizedOrder(c.env.DB, id, distributorId)
    if ('error' in result) return c.json({ error: result.error }, result.status)

    const { results: items } = await c.env.DB.prepare(
        'SELECT * FROM order_items WHERE order_id = ?'
    ).bind(id).all()

    return c.json({ order: result.order, items })
})

/** POST /orders/webhook/:platform - Webhook 接收 */
orders.post('/webhook/:platform', async (c) => {
    const platform = c.req.param('platform').toUpperCase()
    const body = await c.req.json()

    await c.env.ORDER_QUEUE.send({
        platform,
        payload: body,
        receivedAt: new Date().toISOString(),
    })

    return c.json({ status: 'queued', platform })
})

/** PATCH /orders/:id/ship - 发货确认 */
orders.patch('/:id/ship', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ tracking_number: string }>()

    // Validate tracking_number
    if (!body.tracking_number || typeof body.tracking_number !== 'string' ||
        body.tracking_number.trim().length < 1 || body.tracking_number.length > 100) {
        return c.json({ error: 'tracking_number must be 1-100 characters' }, 400)
    }

    const result = await getAuthorizedOrder(c.env.DB, id, distributorId)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    const { order } = result

    // Only PROCESSING orders can be shipped
    if (order.status !== 'PROCESSING') {
        return c.json({ error: 'Only PROCESSING orders can be shipped' }, 400)
    }

    const batch = [
        c.env.DB.prepare("UPDATE orders SET status = 'SHIPPED' WHERE id = ?").bind(id),
        c.env.DB.prepare(
            'INSERT INTO outbound_records (order_id, sku, tracking_number) VALUES (?, ?, ?)'
        ).bind(id, 'BATCH', body.tracking_number),
    ]

    await c.env.DB.batch(batch)

    // 发货通知（不影响发货结果）
    try {
        const notification = new NotificationService(c.env.DB)
        await notification.send({
            type: 'INFO',
            channel: 'LARK',
            message: `訂単 #${id} (${order.platform}) 発送完了 - 追跡番号: ${body.tracking_number}`,
        })
    } catch (e) {
        console.error('Notification failed:', e)
    }

    // Customer communication trigger (best-effort)
    try {
        const commService = new CommunicationService(c.env.DB)
        await commService.triggerOnEvent('ORDER_SHIPPED', id, order.distributor_id)
    } catch (e) {
        console.error('[SHIP] Communication trigger failed:', e)
    }

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'SHIP_ORDER',
        resourceType: 'order',
        resourceId: String(id),
        details: `tracking: ${body.tracking_number}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    // Invalidate dashboard cache
    const cache = new CacheService(c.env.KV)
    cache.invalidate(`dashboard:stats:${c.get('distributorId')}`)

    return c.json({ status: 'shipped', orderId: id, tracking: body.tracking_number })
})

/** PATCH /orders/:id/deliver - 配送完了（管理者のみ） */
orders.patch('/:id/deliver', async (c) => {
    const id = Number(c.req.param('id'))
    const role = c.get('role')

    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id).first<Order>()

    if (!order) {
        return c.json({ error: 'Order not found' }, 404)
    }

    if (order.status !== 'SHIPPED') {
        return c.json({ error: 'Only SHIPPED orders can be delivered' }, 400)
    }

    await c.env.DB.prepare(
        "UPDATE orders SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(id).run()

    // Find frozen amount and deduct
    const freezeTx = await c.env.DB.prepare(
        "SELECT amount FROM wallet_transactions WHERE distributor_id = ? AND type = 'FREEZE' AND related_order_id = ?"
    ).bind(order.distributor_id, String(id)).first<{ amount: number }>()

    if (freezeTx) {
        const walletService = new WalletService(c.env.DB)
        await walletService.deduct(order.distributor_id, freezeTx.amount, String(id))
    }

    // Commission auto-settle (best-effort, does not affect delivery result)
    try {
        const commissionService = new CommissionService(c.env.DB)
        await commissionService.autoSettleOrder(id)
    } catch (e) {
        console.error('[DELIVER] Commission auto-settle failed:', e)
    }

    // In-app notification (best effort)
    try {
        const nc = new NotificationCenterService(c.env.DB)
        await nc.notifyOrderDelivered(order.distributor_id, id)
    } catch (e) {
        console.error('[DELIVER] Notification failed:', e)
    }

    // Customer communication trigger (best-effort)
    try {
        const commService = new CommunicationService(c.env.DB)
        await commService.triggerOnEvent('ORDER_DELIVERED', id, order.distributor_id)
    } catch (e) {
        console.error('[DELIVER] Communication trigger failed:', e)
    }

    // Automation rules evaluation (best-effort)
    try {
        const autoService = new AutomationService(c.env.DB)
        await autoService.evaluateAllRules('EVENT')
    } catch (e) {
        console.error('[DELIVER] Automation trigger failed:', e)
    }

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'DELIVER_ORDER',
        resourceType: 'order',
        resourceId: String(id),
        details: `order delivered, distributor=${order.distributor_id}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    // Invalidate dashboard cache
    const cache = new CacheService(c.env.KV)
    cache.invalidate(`dashboard:stats:${c.get('distributorId')}`)

    const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id).first<Order>()

    return c.json({ order: updated })
})

/** PATCH /orders/:id/cancel - 注文キャンセル */
orders.patch('/:id/cancel', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    let order: Order | null

    if (role === 'admin') {
        order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
            .bind(id).first<Order>()
    } else {
        const result = await getAuthorizedOrder(c.env.DB, id, distributorId)
        if ('error' in result) return c.json({ error: result.error }, result.status)
        order = result.order
    }

    if (!order) {
        return c.json({ error: 'Order not found' }, 404)
    }

    if (order.status !== 'PENDING' && order.status !== 'PROCESSING') {
        return c.json({ error: 'Only PENDING or PROCESSING orders can be cancelled' }, 400)
    }

    await c.env.DB.prepare(
        "UPDATE orders SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(id).run()

    // Find frozen amount and refund if exists
    const freezeTx = await c.env.DB.prepare(
        "SELECT amount FROM wallet_transactions WHERE distributor_id = ? AND type = 'FREEZE' AND related_order_id = ?"
    ).bind(order.distributor_id, String(id)).first<{ amount: number }>()

    if (freezeTx) {
        const walletService = new WalletService(c.env.DB)
        await walletService.refund(order.distributor_id, freezeTx.amount, String(id))
    }

    // In-app notification (best effort)
    try {
        const nc = new NotificationCenterService(c.env.DB)
        await nc.notifyOrderCancelled(order.distributor_id, id)
    } catch (e) {
        console.error('[CANCEL] Notification failed:', e)
    }

    // Customer communication trigger (best-effort)
    try {
        const commService = new CommunicationService(c.env.DB)
        await commService.triggerOnEvent('ORDER_CANCELLED', id, order.distributor_id)
    } catch (e) {
        console.error('[CANCEL] Communication trigger failed:', e)
    }

    // Automation rules evaluation (best-effort)
    try {
        const autoService = new AutomationService(c.env.DB)
        await autoService.evaluateAllRules('EVENT')
    } catch (e) {
        console.error('[CANCEL] Automation trigger failed:', e)
    }

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'CANCEL_ORDER',
        resourceType: 'order',
        resourceId: String(id),
        details: `order cancelled from ${order.status}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    // Invalidate dashboard cache
    const cache = new CacheService(c.env.KV)
    cache.invalidate(`dashboard:stats:${c.get('distributorId')}`)

    const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id).first<Order>()

    return c.json({ order: updated })
})

export { orders }
