import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { adminOnly } from '../middleware/admin'
import { DistributorService } from '../services/distributor.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const distributors = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All routes require admin
distributors.use('/*', adminOnly)

/** GET /distributors/export - CSV export */
distributors.get('/export', async (c) => {
    const { results } = await c.env.DB.prepare(
        'SELECT id, name, balance, frozen_balance, tax_reg_number, role, created_at FROM distributors ORDER BY id DESC LIMIT 5000'
    ).all()

    const csv = toCSV(results as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'name', header: '\u540D\u524D' },              // 名前
        { key: 'role', header: '\u30ED\u30FC\u30EB' },         // ロール
        { key: 'balance', header: '\u6B8B\u9AD8' },            // 残高
        { key: 'frozen_balance', header: '\u51CD\u7D50' },     // 凍結
        { key: 'tax_reg_number', header: '\u767B\u9332\u756A\u53F7' }, // 登録番号
        { key: 'created_at', header: '\u4F5C\u6210\u65E5' },   // 作成日
    ])

    return csvResponse(csv, 'distributors.csv')
})

/** POST /distributors/:id/reset-token - Reset token */
distributors.post('/:id/reset-token', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new DistributorService(c.env.DB, c.env.KV)

    try {
        const result = await service.resetToken(id)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'RESET_TOKEN',
            resourceType: 'distributor',
            resourceId: String(id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, token: result.token })
    } catch (e: any) {
        if (e.message === 'Distributor not found') return c.json({ error: e.message }, 404)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

/** GET /distributors/:id - Detail with aggregated stats */
distributors.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new DistributorService(c.env.DB, c.env.KV)
    const result = await service.getDetail(id)

    if (!result) return c.json({ error: 'Distributor not found' }, 404)

    return c.json(result)
})

/** PUT /distributors/:id - Update */
distributors.put('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ name?: string; tax_reg_number?: string; role?: string }>()

    // Validate
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100)) {
        return c.json({ error: 'Name must be 1-100 characters' }, 400)
    }
    if (body.role !== undefined && !['admin', 'distributor'].includes(body.role)) {
        return c.json({ error: 'Role must be admin or distributor' }, 400)
    }

    const service = new DistributorService(c.env.DB, c.env.KV)
    const result = await service.update(id, {
        name: body.name,
        tax_reg_number: body.tax_reg_number,
        role: body.role as 'admin' | 'distributor' | undefined,
    })

    if (!result) return c.json({ error: 'Distributor not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'UPDATE_DISTRIBUTOR',
        resourceType: 'distributor',
        resourceId: String(id),
        details: JSON.stringify(body),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, distributor: result })
})

/** GET /distributors - List with pagination */
distributors.get('/', async (c) => {
    const rawLimit = Number(c.req.query('limit') || 50)
    const rawOffset = Number(c.req.query('offset') || 0)
    const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200))
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset)

    const service = new DistributorService(c.env.DB, c.env.KV)
    const { distributors: list, total } = await service.list(limit, offset)

    return c.json({
        distributors: list,
        total,
        count: list.length,
        hasMore: offset + list.length < total,
    })
})

/** POST /distributors - Create */
distributors.post('/', async (c) => {
    const body = await c.req.json<{ name: string; username?: string; password?: string; tax_reg_number?: string; role?: string }>()

    if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
        return c.json({ error: 'Name is required (1-100 characters)' }, 400)
    }
    if (body.role && !['admin', 'distributor'].includes(body.role)) {
        return c.json({ error: 'Role must be admin or distributor' }, 400)
    }
    if (body.username && (body.username.length < 3 || body.username.length > 50)) {
        return c.json({ error: 'Username must be 3-50 characters' }, 400)
    }
    if (body.username && !/^[a-zA-Z0-9_]+$/.test(body.username)) {
        return c.json({ error: 'Username can only contain letters, numbers, and underscores' }, 400)
    }
    if (body.password && body.password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const service = new DistributorService(c.env.DB, c.env.KV)
    try {
        const distributor = await service.create({
            name: body.name,
            username: body.username,
            password: body.password,
            tax_reg_number: body.tax_reg_number,
            role: (body.role as 'admin' | 'distributor') || 'distributor',
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_DISTRIBUTOR',
            resourceType: 'distributor',
            resourceId: String(distributor.id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, distributor }, 201)
    } catch (e: any) {
        if (e.message === 'Username already exists') {
            return c.json({ error: e.message }, 409)
        }
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export { distributors }
