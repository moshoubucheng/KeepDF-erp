import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CustomerService } from '../services/customer.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const customers = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /customers/export - CSV export */
customers.get('/export', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new CustomerService(c.env.DB)
    const { customers: list } = await service.list({ distributorId, role, limit: 5000 })

    const csv = toCSV(list as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'name', header: '\u540D\u524D' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: '\u96FB\u8A71' },
        { key: 'city', header: '\u5E02\u533A\u753A\u6751' },
        { key: 'prefecture', header: '\u90FD\u9053\u5E9C\u770C' },
        { key: 'platform', header: '\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0' },
        { key: 'created_at', header: '\u4F5C\u6210\u65E5' },
    ])

    return csvResponse(csv, 'customers.csv')
})

/** GET /customers/:id/orders - Customer order history */
customers.get('/:id/orders', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new CustomerService(c.env.DB)
    const orders = await service.getOrders(id, distributorId, role)

    return c.json({ orders })
})

/** GET /customers/:id - Customer detail */
customers.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new CustomerService(c.env.DB)
    const customer = await service.getDetail(id, distributorId, role)

    if (!customer) return c.json({ error: 'Customer not found' }, 404)
    return c.json({ customer })
})

/** GET /customers - List customers */
customers.get('/', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')
    const search = c.req.query('search')
    const tag = c.req.query('tag')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new CustomerService(c.env.DB)
    const result = await service.list({ distributorId, role, search, tag, limit, offset })

    return c.json({
        customers: result.customers,
        total: result.total,
        count: result.customers.length,
        hasMore: offset + result.customers.length < result.total,
    })
})

/** POST /customers - Create customer */
customers.post('/', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<any>()

    if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200) {
        return c.json({ error: 'Name is required (1-200 characters)' }, 400)
    }

    const service = new CustomerService(c.env.DB)
    const customer = await service.create({
        ...body,
        distributor_id: distributorId,
    })

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'CREATE_CUSTOMER',
        resourceType: 'customer',
        resourceId: String(customer.id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, customer }, 201)
})

/** PUT /customers/:id - Update customer */
customers.put('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const role = c.get('role')
    const body = await c.req.json<any>()

    const service = new CustomerService(c.env.DB)
    const customer = await service.update(id, distributorId, role, body)

    if (!customer) return c.json({ error: 'Customer not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'UPDATE_CUSTOMER',
        resourceType: 'customer',
        resourceId: String(id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, customer })
})

export { customers }
