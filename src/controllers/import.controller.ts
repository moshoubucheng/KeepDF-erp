import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ImportService } from '../services/import.service'
import { AuditService } from '../services/audit.service'

const importCtrl = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** POST /import/products - Import products from CSV */
importCtrl.post('/products', async (c) => {
    const distributorId = c.get('distributorId')

    const contentType = c.req.header('content-type') || ''
    let csvText: string

    if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData()
        const file = formData.get('file') as File | null
        if (!file) return c.json({ error: 'CSV file is required' }, 400)
        csvText = await file.text()
    } else {
        const body = await c.req.json<{ csv: string }>()
        csvText = body.csv
    }

    if (!csvText || csvText.trim().length === 0) {
        return c.json({ error: 'CSV data is empty' }, 400)
    }

    const service = new ImportService(c.env.DB)
    const result = await service.importProducts(csvText, distributorId)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'IMPORT_CSV',
        resourceType: 'import',
        details: `type=PRODUCTS, total=${result.total}, success=${result.success}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

/** POST /import/orders - Import orders from CSV */
importCtrl.post('/orders', async (c) => {
    const distributorId = c.get('distributorId')

    const contentType = c.req.header('content-type') || ''
    let csvText: string

    if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData()
        const file = formData.get('file') as File | null
        if (!file) return c.json({ error: 'CSV file is required' }, 400)
        csvText = await file.text()
    } else {
        const body = await c.req.json<{ csv: string }>()
        csvText = body.csv
    }

    if (!csvText || csvText.trim().length === 0) {
        return c.json({ error: 'CSV data is empty' }, 400)
    }

    const service = new ImportService(c.env.DB)
    const result = await service.importOrders(csvText, distributorId)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'IMPORT_CSV',
        resourceType: 'import',
        details: `type=ORDERS, total=${result.total}, success=${result.success}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

/** POST /import/batch-update - Batch update order statuses */
importCtrl.post('/batch-update', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')
    const body = await c.req.json<{ updates: { order_id: number; status: string }[] }>()

    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
        return c.json({ error: 'updates array is required' }, 400)
    }

    if (body.updates.length > 200) {
        return c.json({ error: 'Maximum 200 updates per batch' }, 400)
    }

    const service = new ImportService(c.env.DB)
    const result = await service.batchUpdateStatus(body.updates, distributorId, role)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'BATCH_UPDATE',
        resourceType: 'order',
        details: `success=${result.success}, errors=${result.errors.length}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json(result)
})

/** GET /import/logs - Import history */
importCtrl.get('/logs', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new ImportService(c.env.DB)
    const logs = await service.getLogs(distributorId, role)

    return c.json({ logs })
})

/** GET /import/templates/products - Download product CSV template */
importCtrl.get('/templates/products', async (c) => {
    const service = new ImportService(c.env.DB)
    const csv = service.getProductTemplate()

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="products-template.csv"',
        },
    })
})

/** GET /import/templates/orders - Download order CSV template */
importCtrl.get('/templates/orders', async (c) => {
    const service = new ImportService(c.env.DB)
    const csv = service.getOrderTemplate()

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="orders-template.csv"',
        },
    })
})

export { importCtrl }
