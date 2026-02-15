import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ApprovalService } from '../services/approval.service'
import { adminOnly } from '../middleware/admin'

const approvals = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /approvals/workflows - List workflows (admin) */
approvals.get('/workflows', adminOnly, async (c) => {
    const service = new ApprovalService(c.env.DB)
    const workflows = await service.listWorkflows({
        resource_type: c.req.query('resource_type') || undefined,
    })
    return c.json({ workflows })
})

/** POST /approvals/workflows - Create workflow (admin) */
approvals.post('/workflows', adminOnly, async (c) => {
    const body = await c.req.json()
    const service = new ApprovalService(c.env.DB)
    try {
        const workflow = await service.createWorkflow(body)
        return c.json(workflow, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** PATCH /approvals/workflows/:id - Update workflow (admin) */
approvals.patch('/workflows/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const service = new ApprovalService(c.env.DB)
    const result = await service.updateWorkflow(id, body)
    if (!result) return c.json({ error: 'Workflow not found' }, 404)
    return c.json(result)
})

/** DELETE /approvals/workflows/:id - Delete workflow (admin) */
approvals.delete('/workflows/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const service = new ApprovalService(c.env.DB)
    const deleted = await service.deleteWorkflow(id)
    if (!deleted) return c.json({ error: 'Workflow not found' }, 404)
    return c.json({ success: true })
})

/** GET /approvals/requests - List requests */
approvals.get('/requests', async (c) => {
    const service = new ApprovalService(c.env.DB)
    const role = c.get('role')
    const result = await service.listRequests({
        status: c.req.query('status') || undefined,
        resource_type: c.req.query('resource_type') || undefined,
        requested_by: role !== 'admin' ? c.get('distributorId') : undefined,
        limit: Number(c.req.query('limit') || 50),
        offset: Number(c.req.query('offset') || 0),
    })
    return c.json(result)
})

/** POST /approvals/requests/:id/approve - Approve (admin) */
approvals.post('/requests/:id/approve', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }))
    const service = new ApprovalService(c.env.DB)
    try {
        const result = await service.approve(id, c.get('distributorId'), body.reason)
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /approvals/requests/:id/reject - Reject (admin) */
approvals.post('/requests/:id/reject', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ reason: string }>()
    const service = new ApprovalService(c.env.DB)
    try {
        const result = await service.reject(id, c.get('distributorId'), body.reason)
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

export { approvals }
