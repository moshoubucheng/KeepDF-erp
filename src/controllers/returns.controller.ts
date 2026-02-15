import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ReturnService } from '../services/return.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const returns = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /returns/export - CSV export */
returns.get('/export', async (c) => {
    const service = new ReturnService(c.env.DB)
    const { returns: data } = await service.list(
        c.get('distributorId'), c.get('role'), { limit: 5000 }
    )

    const csv = toCSV(data as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'order_id', header: '注文ID' },
        { key: 'platform', header: 'プラットフォーム' },
        { key: 'status', header: 'ステータス' },
        { key: 'reason', header: '理由' },
        { key: 'refund_type', header: '返金タイプ' },
        { key: 'refund_amount', header: '返金額' },
        { key: 'created_at', header: '申請日' },
    ])

    return csvResponse(csv, 'returns.csv')
})

/** GET /returns - List returns */
returns.get('/', async (c) => {
    const status = c.req.query('status')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new ReturnService(c.env.DB)
    const result = await service.list(
        c.get('distributorId'), c.get('role'),
        { status: status || undefined, limit, offset }
    )

    return c.json({ returns: result.returns, total: result.total })
})

/** GET /returns/:id - Return detail */
returns.get('/:id', async (c) => {
    const service = new ReturnService(c.env.DB)
    const result = await service.getById(
        Number(c.req.param('id')),
        c.get('distributorId'), c.get('role')
    )

    if (!result) return c.json({ error: 'Return not found' }, 404)
    return c.json(result)
})

/** POST /returns - Create return request */
returns.post('/', async (c) => {
    const body = await c.req.json<{
        order_id: number
        reason?: string
        notes?: string
        refund_type?: string
        items: { sku: string; qty: number; unit_price: number; reason?: string }[]
    }>()

    if (!body.order_id || !body.items || body.items.length === 0) {
        return c.json({ error: 'order_id and items are required' }, 400)
    }

    const service = new ReturnService(c.env.DB)
    try {
        const ret = await service.create({
            orderId: body.order_id,
            reason: body.reason,
            notes: body.notes,
            refundType: body.refund_type,
            items: body.items,
            distributorId: c.get('distributorId'),
            role: c.get('role'),
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_RETURN',
            resourceType: 'return',
            resourceId: String(ret.id),
            details: `order=${body.order_id}, items=${body.items.length}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, return: ret }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /returns/:id/approve - Approve return (admin only) */
returns.patch('/:id/approve', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new ReturnService(c.env.DB)
    try {
        const ret = await service.approve(Number(c.req.param('id')))

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'APPROVE_RETURN',
            resourceType: 'return',
            resourceId: c.req.param('id'),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, return: ret })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /returns/:id/reject - Reject return (admin only) */
returns.patch('/:id/reject', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json<{ reason?: string }>().catch(() => ({}))

    const service = new ReturnService(c.env.DB)
    try {
        const ret = await service.reject(Number(c.req.param('id')), (body as any).reason)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'REJECT_RETURN',
            resourceType: 'return',
            resourceId: c.req.param('id'),
            details: (body as any).reason || '',
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, return: ret })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /returns/:id/receive - Receive returned items (admin only) */
returns.patch('/:id/receive', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new ReturnService(c.env.DB)
    try {
        const ret = await service.receive(Number(c.req.param('id')))

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'RECEIVE_RETURN',
            resourceType: 'return',
            resourceId: c.req.param('id'),
            details: 'inventory restocked',
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, return: ret })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /returns/:id/refund - Process refund (admin only) */
returns.patch('/:id/refund', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new ReturnService(c.env.DB)
    try {
        const ret = await service.refund(Number(c.req.param('id')))

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'REFUND_RETURN',
            resourceType: 'return',
            resourceId: c.req.param('id'),
            details: `amount=${ret.refund_amount}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, return: ret })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

export { returns }
