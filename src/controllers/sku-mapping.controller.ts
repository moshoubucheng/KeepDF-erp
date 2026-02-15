import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { SkuMappingService } from '../services/sku-mapping.service'
import { toCSV, csvResponse } from '../utils/csv'

const skuMappings = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /sku-mappings/export - CSV export */
skuMappings.get('/export', async (c) => {
    const service = new SkuMappingService(c.env.DB)
    const mappings = await service.exportAll()

    const csv = toCSV(mappings as unknown as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'local_sku', header: 'Local SKU' },
        { key: 'platform', header: 'Platform' },
        { key: 'platform_sku', header: 'Platform SKU' },
        { key: 'platform_title', header: 'Title' },
        { key: 'price_sync', header: 'Price Sync' },
        { key: 'stock_sync', header: 'Stock Sync' },
        { key: 'is_active', header: 'Active' },
    ])

    return csvResponse(csv, 'sku-mappings.csv')
})

/** GET /sku-mappings/validate - Validate all mappings (admin) */
skuMappings.get('/validate', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const service = new SkuMappingService(c.env.DB)
    const result = await service.validateMappings()
    return c.json(result)
})

/** GET /sku-mappings/by-sku/:sku - Get mappings by local SKU */
skuMappings.get('/by-sku/:sku', async (c) => {
    const sku = c.req.param('sku')
    const service = new SkuMappingService(c.env.DB)
    const mappings = await service.getByLocalSku(sku)
    return c.json({ mappings })
})

/** GET /sku-mappings - List mappings */
skuMappings.get('/', async (c) => {
    const platform = c.req.query('platform')
    const local_sku = c.req.query('local_sku')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new SkuMappingService(c.env.DB)
    const result = await service.list({ platform, local_sku, limit, offset })
    return c.json({ mappings: result.mappings, total: result.total, count: result.mappings.length })
})

/** GET /sku-mappings/:id - Get mapping detail */
skuMappings.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new SkuMappingService(c.env.DB)
    const mapping = await service.getById(id)
    if (!mapping) return c.json({ error: 'Mapping not found' }, 404)
    return c.json({ mapping })
})

/** POST /sku-mappings - Create mapping (admin) */
skuMappings.post('/', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const body = await c.req.json<{
        local_sku: string; platform: string; platform_sku: string
        price_sync?: number; stock_sync?: number; platform_title?: string; platform_description?: string
    }>()

    if (!body.local_sku || !body.platform || !body.platform_sku) {
        return c.json({ error: 'local_sku, platform, and platform_sku are required' }, 400)
    }

    const service = new SkuMappingService(c.env.DB)
    try {
        const mapping = await service.create(body)
        return c.json({ success: true, mapping }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /sku-mappings/:id - Update mapping (admin) */
skuMappings.put('/:id', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const body = await c.req.json()

    const service = new SkuMappingService(c.env.DB)
    const mapping = await service.update(id, body)
    if (!mapping) return c.json({ error: 'Mapping not found' }, 404)
    return c.json({ success: true, mapping })
})

/** DELETE /sku-mappings/:id - Delete mapping (admin) */
skuMappings.delete('/:id', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const id = Number(c.req.param('id'))
    const service = new SkuMappingService(c.env.DB)
    const deleted = await service.delete(id)
    if (!deleted) return c.json({ error: 'Mapping not found' }, 404)
    return c.json({ success: true })
})

/** POST /sku-mappings/import - Bulk import (admin) */
skuMappings.post('/import', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const body = await c.req.json<{ mappings: any[] }>()
    if (!body.mappings || !Array.isArray(body.mappings)) {
        return c.json({ error: 'mappings array is required' }, 400)
    }

    const service = new SkuMappingService(c.env.DB)
    const result = await service.bulkImport(body.mappings)
    return c.json(result)
})

export { skuMappings }
