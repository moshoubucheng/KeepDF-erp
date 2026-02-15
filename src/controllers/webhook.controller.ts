import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { WebhookService } from '../services/webhook.service'

const webhooks = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /webhooks - List endpoints */
webhooks.get('/', async (c) => {
    const service = new WebhookService(c.env.DB)
    const endpoints = await service.listEndpoints(c.get('distributorId'), c.get('role'))
    return c.json({ endpoints })
})

/** POST /webhooks - Create endpoint */
webhooks.post('/', async (c) => {
    const body = await c.req.json()
    const service = new WebhookService(c.env.DB)
    try {
        const endpoint = await service.createEndpoint(body, c.get('distributorId'))
        return c.json(endpoint, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /webhooks/:id - Update endpoint */
webhooks.patch('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const service = new WebhookService(c.env.DB)
    const result = await service.updateEndpoint(id, body, c.get('distributorId'), c.get('role'))
    if (!result) return c.json({ error: 'Endpoint not found' }, 404)
    return c.json(result)
})

/** DELETE /webhooks/:id - Delete endpoint */
webhooks.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new WebhookService(c.env.DB)
    const deleted = await service.deleteEndpoint(id, c.get('distributorId'), c.get('role'))
    if (!deleted) return c.json({ error: 'Endpoint not found' }, 404)
    return c.json({ success: true })
})

/** GET /webhooks/:id/logs - List webhook logs */
webhooks.get('/:id/logs', async (c) => {
    const id = Number(c.req.param('id'))
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)
    const service = new WebhookService(c.env.DB)
    const result = await service.listLogs(id, limit, offset)
    return c.json(result)
})

/** POST /webhooks/:id/test - Send test webhook */
webhooks.post('/:id/test', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new WebhookService(c.env.DB)
    const endpoint = await c.env.DB.prepare('SELECT * FROM webhook_endpoints WHERE id = ?').bind(id).first<any>()
    if (!endpoint) return c.json({ error: 'Endpoint not found' }, 404)

    try {
        await service.sendWebhook(endpoint, 'TEST', { message: 'Test webhook from KeepDF ERP' })
        return c.json({ success: true })
    } catch (e: any) {
        return c.json({ success: false, error: e.message })
    }
})

export { webhooks }
