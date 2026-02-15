import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CommunicationService } from '../services/communication.service'
import { AuditService } from '../services/audit.service'

const communications = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ===== Templates =====

/** GET /communications/templates - List templates */
communications.get('/templates', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const type = c.req.query('type')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const result = await service.listTemplates(
        c.get('distributorId'), c.get('role'),
        { type: type || undefined, limit, offset }
    )

    return c.json({ templates: result.templates, total: result.total })
})

/** GET /communications/templates/:id - Template detail */
communications.get('/templates/:id', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const template = await service.getTemplate(
        Number(c.req.param('id')), c.get('distributorId'), c.get('role')
    )

    if (!template) return c.json({ error: 'Template not found' }, 404)
    return c.json({ template })
})

/** POST /communications/templates - Create template */
communications.post('/templates', async (c) => {
    const body = await c.req.json()
    const service = new CommunicationService(c.env.DB)

    try {
        const template = await service.createTemplate({
            ...body,
            distributorId: c.get('distributorId'),
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_TEMPLATE',
            resourceType: 'message_template',
            resourceId: String(template.id),
            details: `name=${template.name}, type=${template.type}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, template }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /communications/templates/:id - Update template */
communications.put('/templates/:id', async (c) => {
    const body = await c.req.json()
    const service = new CommunicationService(c.env.DB)

    const template = await service.updateTemplate(
        Number(c.req.param('id')), body,
        c.get('distributorId'), c.get('role')
    )

    if (!template) return c.json({ error: 'Template not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'UPDATE_TEMPLATE',
        resourceType: 'message_template',
        resourceId: String(template.id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, template })
})

/** DELETE /communications/templates/:id - Delete template */
communications.delete('/templates/:id', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const result = await service.deleteTemplate(
        Number(c.req.param('id')),
        c.get('distributorId'), c.get('role')
    )

    if (!result) return c.json({ error: 'Template not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'DELETE_TEMPLATE',
        resourceType: 'message_template',
        resourceId: c.req.param('id'),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

// ===== Messages =====

/** GET /communications/messages - Message history */
communications.get('/messages', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const type = c.req.query('type')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const result = await service.listMessages(
        c.get('distributorId'), c.get('role'),
        { type: type || undefined, limit, offset }
    )

    return c.json({ messages: result.messages, total: result.total })
})

/** GET /communications/messages/customer/:id - Customer messages */
communications.get('/messages/customer/:id', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const messages = await service.getCustomerMessages(
        Number(c.req.param('id')),
        c.get('distributorId'), c.get('role')
    )

    return c.json({ messages })
})

/** POST /communications/send - Send message */
communications.post('/send', async (c) => {
    const body = await c.req.json<{
        customer_id: number
        template_id?: number
        type: string
        subject?: string
        content: string
        channel?: string
        related_order_id?: number
    }>()

    if (!body.customer_id || !body.type || !body.content) {
        return c.json({ error: 'customer_id, type, and content are required' }, 400)
    }

    const service = new CommunicationService(c.env.DB)
    try {
        const message = await service.sendMessage({
            customerId: body.customer_id,
            templateId: body.template_id,
            type: body.type,
            subject: body.subject,
            content: body.content,
            channel: body.channel,
            relatedOrderId: body.related_order_id,
            distributorId: c.get('distributorId'),
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'SEND_MESSAGE',
            resourceType: 'customer_message',
            resourceId: String(message.id),
            details: `customer=${body.customer_id}, type=${body.type}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, message }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

// ===== Triggers =====

/** GET /communications/triggers - List triggers */
communications.get('/triggers', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const triggers = await service.listTriggers(c.get('distributorId'), c.get('role'))
    return c.json({ triggers })
})

/** POST /communications/triggers - Create trigger */
communications.post('/triggers', async (c) => {
    const body = await c.req.json<{
        event_type: string
        template_id: number
    }>()

    if (!body.event_type || !body.template_id) {
        return c.json({ error: 'event_type and template_id are required' }, 400)
    }

    const service = new CommunicationService(c.env.DB)
    try {
        const trigger = await service.createTrigger({
            eventType: body.event_type,
            templateId: body.template_id,
            distributorId: c.get('distributorId'),
        })

        return c.json({ success: true, trigger }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** DELETE /communications/triggers/:id - Delete trigger */
communications.delete('/triggers/:id', async (c) => {
    const service = new CommunicationService(c.env.DB)
    const result = await service.deleteTrigger(
        Number(c.req.param('id')),
        c.get('distributorId'), c.get('role')
    )

    if (!result) return c.json({ error: 'Trigger not found' }, 404)
    return c.json({ success: true })
})

export { communications }
