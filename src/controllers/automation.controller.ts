import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { AutomationService } from '../services/automation.service'
import { AuditService } from '../services/audit.service'

const automation = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All automation endpoints are admin-only
const adminGuard = async (c: any, next: () => Promise<void>) => {
    if (c.get('role') !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }
    await next()
}

automation.use('/*', adminGuard)

/** GET /automation - List rules */
automation.get('/', async (c) => {
    const service = new AutomationService(c.env.DB)
    const rules = await service.list(c.get('distributorId'), c.get('role'))
    return c.json({ rules })
})

/** GET /automation/logs - Execution logs (must be before /:id) */
automation.get('/logs', async (c) => {
    const ruleId = c.req.query('rule_id') ? Number(c.req.query('rule_id')) : undefined
    const status = c.req.query('status')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new AutomationService(c.env.DB)
    const result = await service.getLogs({ ruleId, status, limit, offset })
    return c.json(result)
})

/** GET /automation/:id - Rule detail */
automation.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')
    const service = new AutomationService(c.env.DB)
    const rule = await service.getById(id, distributorId)

    if (!rule) return c.json({ error: 'Rule not found' }, 404)
    return c.json({ rule })
})

/** POST /automation - Create rule */
automation.post('/', async (c) => {
    const body = await c.req.json<{
        name: string
        type: string
        conditions: Record<string, unknown>
        actions: Record<string, unknown>
    }>()

    if (!body.name || !body.type || !body.conditions || !body.actions) {
        return c.json({ error: 'name, type, conditions, and actions are required' }, 400)
    }

    const service = new AutomationService(c.env.DB)
    try {
        const rule = await service.create({
            name: body.name,
            type: body.type,
            conditions: body.conditions,
            actions: body.actions,
            distributorId: c.get('distributorId'),
        })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'CREATE_AUTOMATION_RULE',
            resourceType: 'automation_rule',
            resourceId: String(rule.id),
            details: `type=${body.type}, name=${body.name}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ rule }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PUT /automation/:id - Update rule */
automation.put('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{
        name?: string
        conditions?: Record<string, unknown>
        actions?: Record<string, unknown>
        is_active?: number
    }>()

    const service = new AutomationService(c.env.DB)
    try {
        const rule = await service.update(id, body)
        if (!rule) return c.json({ error: 'Rule not found' }, 404)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'UPDATE_AUTOMATION_RULE',
            resourceType: 'automation_rule',
            resourceId: String(id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ rule })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** DELETE /automation/:id - Delete rule */
automation.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new AutomationService(c.env.DB)
    const deleted = await service.delete(id)

    if (!deleted) return c.json({ error: 'Rule not found' }, 404)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'DELETE_AUTOMATION_RULE',
        resourceType: 'automation_rule',
        resourceId: String(id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

/** POST /automation/:id/run - Manually trigger a single rule */
automation.post('/:id/run', async (c) => {
    const id = Number(c.req.param('id'))
    const service = new AutomationService(c.env.DB)

    try {
        const log = await service.evaluateRule(id, 'MANUAL')

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: c.get('distributorId'),
            action: 'RUN_AUTOMATION_RULE',
            resourceType: 'automation_log',
            resourceId: String(log.id),
            details: `rule_id=${id}, status=${log.status}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ log })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /automation/evaluate-all - Evaluate all active rules */
automation.post('/evaluate-all', async (c) => {
    const service = new AutomationService(c.env.DB)
    const result = await service.evaluateAllRules('MANUAL')
    return c.json(result)
})

export { automation }
