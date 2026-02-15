import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { PricingService } from '../services/pricing.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const pricing = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /pricing/export - CSV export */
pricing.get('/export', async (c) => {
    const service = new PricingService(c.env.DB)
    const { rules } = await service.list({ limit: 5000 })

    const csv = toCSV(rules as unknown as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'sku', header: 'SKU' },
        { key: 'platform', header: 'プラットフォーム' },
        { key: 'base_price', header: '基本価格' },
        { key: 'sale_price', header: 'セール価格' },
        { key: 'valid_from', header: '開始日' },
        { key: 'valid_to', header: '終了日' },
        { key: 'is_active', header: '有効' },
    ])

    return csvResponse(csv, 'price-rules.csv')
})

/** GET /pricing/history - Price change history */
pricing.get('/history', async (c) => {
    const sku = c.req.query('sku')
    const platform = c.req.query('platform')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new PricingService(c.env.DB)
    const result = await service.getHistory({ sku: sku || undefined, platform: platform || undefined, limit, offset })

    return c.json({ history: result.history, total: result.total })
})

/** GET /pricing/margins - Profit margin analysis */
pricing.get('/margins', async (c) => {
    const sku = c.req.query('sku')
    const platform = c.req.query('platform')

    const service = new PricingService(c.env.DB)
    const margins = await service.getMargins({ sku: sku || undefined, platform: platform || undefined })

    return c.json({ margins })
})

/** GET /pricing - List price rules */
pricing.get('/', async (c) => {
    const sku = c.req.query('sku')
    const platform = c.req.query('platform')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new PricingService(c.env.DB)
    const result = await service.list({ sku: sku || undefined, platform: platform || undefined, limit, offset })

    return c.json({ rules: result.rules, total: result.total })
})

/** GET /pricing/:id - Price rule detail */
pricing.get('/:id', async (c) => {
    const service = new PricingService(c.env.DB)
    const rule = await service.getById(Number(c.req.param('id')))

    if (!rule) return c.json({ error: 'Price rule not found' }, 404)
    return c.json({ rule })
})

/** POST /pricing - Create price rule (admin only) */
pricing.post('/', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json()
    const service = new PricingService(c.env.DB)

    try {
        const rule = await service.create(body, c.get('distributorId'))

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_PRICE_RULE',
            resourceType: 'price_rule',
            resourceId: String(rule.id),
            details: `sku=${rule.sku}, platform=${rule.platform}, price=${rule.base_price}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, rule }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /pricing/:id - Update price rule (admin only) */
pricing.put('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json()
    const service = new PricingService(c.env.DB)
    const rule = await service.update(Number(c.req.param('id')), body, c.get('distributorId'))

    if (!rule) return c.json({ error: 'Price rule not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'UPDATE_PRICE_RULE',
        resourceType: 'price_rule',
        resourceId: String(rule.id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, rule })
})

/** DELETE /pricing/:id - Delete price rule (admin only) */
pricing.delete('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new PricingService(c.env.DB)
    const result = await service.delete(Number(c.req.param('id')))

    if (!result) return c.json({ error: 'Price rule not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'DELETE_PRICE_RULE',
        resourceType: 'price_rule',
        resourceId: c.req.param('id'),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

/** POST /pricing/batch - Batch price update (admin only) */
pricing.post('/batch', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json<{ updates: { sku: string; platform: string; base_price: number }[] }>()
    if (!body.updates || !Array.isArray(body.updates)) {
        return c.json({ error: 'updates array is required' }, 400)
    }

    const service = new PricingService(c.env.DB)
    const result = await service.batchUpdate(body.updates, c.get('distributorId'))

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'BATCH_PRICE_UPDATE',
        resourceType: 'price_rule',
        details: `updated=${result.updated}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

/** POST /pricing/import - CSV import (admin only) */
pricing.post('/import', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json<{ data: { sku: string; platform: string; base_price: number }[] }>()
    if (!body.data || !Array.isArray(body.data)) {
        return c.json({ error: 'data array is required' }, 400)
    }

    const service = new PricingService(c.env.DB)
    const result = await service.batchUpdate(body.data, c.get('distributorId'))

    return c.json({ imported: result.updated, errors: result.errors })
})

export { pricing }
