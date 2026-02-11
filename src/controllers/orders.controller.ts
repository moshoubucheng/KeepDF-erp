import { Hono } from 'hono'
import type { Bindings, Variables, Order } from '../db/types'
import { NotificationService } from '../services/notification.service'

const orders = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /orders - 订单列表 */
orders.get('/', async (c) => {
    const distributorId = c.get('distributorId')
    const platform = c.req.query('platform')
    const status = c.req.query('status')
    const limit = Number(c.req.query('limit') || 50)

    let sql = 'SELECT * FROM orders WHERE distributor_id = ?'
    const params: any[] = [distributorId]

    if (platform) {
        sql += ' AND platform = ?'
        params.push(platform.toUpperCase())
    }
    if (status) {
        sql += ' AND status = ?'
        params.push(status.toUpperCase())
    }

    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const stmt = c.env.DB.prepare(sql)
    const { results } = await stmt.bind(...params).all<Order>()

    return c.json({ orders: results, count: results.length })
})

/** GET /orders/:id - 订单详情（含 items） */
orders.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id).first<Order>()

    if (!order) return c.json({ error: 'Order not found' }, 404)

    if (order.distributor_id !== distributorId) {
        return c.json({ error: 'Forbidden: order does not belong to you' }, 403)
    }

    const { results: items } = await c.env.DB.prepare(
        'SELECT * FROM order_items WHERE order_id = ?'
    ).bind(id).all()

    return c.json({ order, items })
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

    const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id).first<Order>()

    if (!order) return c.json({ error: 'Order not found' }, 404)

    if (order.distributor_id !== distributorId) {
        return c.json({ error: 'Forbidden: order does not belong to you' }, 403)
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

    return c.json({ status: 'shipped', orderId: id, tracking: body.tracking_number })
})

export { orders }
