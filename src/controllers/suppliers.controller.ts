import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { SupplierService } from '../services/supplier.service'
import { AuditService } from '../services/audit.service'

const suppliers = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /suppliers - List suppliers (admin only) */
suppliers.get('/', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const isActive = c.req.query('is_active')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new SupplierService(c.env.DB)
    const result = await service.list({
        isActive: isActive !== undefined ? Number(isActive) : undefined,
        limit, offset,
    })

    return c.json({ suppliers: result.suppliers, total: result.total })
})

/** GET /suppliers/:id - Supplier detail (admin only) */
suppliers.get('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new SupplierService(c.env.DB)
    const supplier = await service.getById(Number(c.req.param('id')))
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404)

    return c.json({ supplier })
})

/** POST /suppliers - Create supplier (admin only) */
suppliers.post('/', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json()
    const service = new SupplierService(c.env.DB)

    try {
        const supplier = await service.create(body)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_SUPPLIER',
            resourceType: 'supplier',
            resourceId: String(supplier.id),
            details: `name=${supplier.name}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, supplier }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /suppliers/:id - Update supplier (admin only) */
suppliers.put('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const body = await c.req.json()
    const service = new SupplierService(c.env.DB)
    const supplier = await service.update(Number(c.req.param('id')), body)

    if (!supplier) return c.json({ error: 'Supplier not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'UPDATE_SUPPLIER',
        resourceType: 'supplier',
        resourceId: String(supplier.id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, supplier })
})

/** DELETE /suppliers/:id - Deactivate supplier (admin only) */
suppliers.delete('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new SupplierService(c.env.DB)
    const result = await service.deactivate(Number(c.req.param('id')))

    if (!result) return c.json({ error: 'Supplier not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'DELETE_SUPPLIER',
        resourceType: 'supplier',
        resourceId: c.req.param('id'),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

export { suppliers }
