import { NotificationCenterService } from './notification-center.service'

const VALID_RESOURCE_TYPES = ['PURCHASE_ORDER', 'RETURN_REFUND', 'LARGE_ORDER'] as const
const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export class ApprovalService {
    private notificationCenter: NotificationCenterService

    constructor(private db: D1Database) {
        this.notificationCenter = new NotificationCenterService(db)
    }

    async listWorkflows(filters?: {
        resource_type?: string
        is_active?: number
    }): Promise<any[]> {
        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.resource_type) {
            where += ' AND resource_type = ?'
            params.push(filters.resource_type.toUpperCase())
        }
        if (filters?.is_active !== undefined) {
            where += ' AND is_active = ?'
            params.push(filters.is_active)
        }

        const { results } = await this.db.prepare(
            `SELECT * FROM approval_workflows ${where} ORDER BY created_at DESC`
        ).bind(...params).all()
        return results
    }

    async createWorkflow(data: {
        name: string
        resource_type: string
        conditions: any
        approver_ids: number[]
    }): Promise<any> {
        if (!data.name || !data.resource_type) throw new Error('name and resource_type are required')
        if (!VALID_RESOURCE_TYPES.includes(data.resource_type as any)) {
            throw new Error(`Invalid resource_type. Must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`)
        }

        const { meta } = await this.db.prepare(
            `INSERT INTO approval_workflows (name, resource_type, conditions, approver_ids)
             VALUES (?, ?, ?, ?)`
        ).bind(
            data.name,
            data.resource_type,
            JSON.stringify(data.conditions || {}),
            JSON.stringify(data.approver_ids || []),
        ).run()

        return this.db.prepare('SELECT * FROM approval_workflows WHERE id = ?').bind(meta.last_row_id).first()
    }

    async updateWorkflow(id: number, data: Partial<{
        name: string; resource_type: string
        conditions: any; approver_ids: number[]
        is_active: number
    }>): Promise<any | null> {
        const existing = await this.db.prepare('SELECT * FROM approval_workflows WHERE id = ?').bind(id).first()
        if (!existing) return null

        const fields: string[] = []
        const binds: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); binds.push(data.name) }
        if (data.resource_type !== undefined) { fields.push('resource_type = ?'); binds.push(data.resource_type) }
        if (data.conditions !== undefined) { fields.push('conditions = ?'); binds.push(JSON.stringify(data.conditions)) }
        if (data.approver_ids !== undefined) { fields.push('approver_ids = ?'); binds.push(JSON.stringify(data.approver_ids)) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); binds.push(data.is_active) }

        if (fields.length === 0) return existing
        binds.push(id)

        await this.db.prepare(`UPDATE approval_workflows SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()
        return this.db.prepare('SELECT * FROM approval_workflows WHERE id = ?').bind(id).first()
    }

    async deleteWorkflow(id: number): Promise<boolean> {
        const { meta } = await this.db.prepare('DELETE FROM approval_workflows WHERE id = ?').bind(id).run()
        return (meta.changes ?? 0) > 0
    }

    async checkRequiresApproval(resourceType: string, amount: number): Promise<{ required: boolean; workflow?: any }> {
        const { results: workflows } = await this.db.prepare(
            'SELECT * FROM approval_workflows WHERE resource_type = ? AND is_active = 1'
        ).bind(resourceType.toUpperCase()).all<any>()

        for (const wf of workflows) {
            const conditions = JSON.parse(wf.conditions || '{}')
            if (conditions.min_amount && amount >= conditions.min_amount) {
                return { required: true, workflow: wf }
            }
            if (conditions.max_amount && amount <= conditions.max_amount) {
                return { required: true, workflow: wf }
            }
            // If no amount conditions, always require approval
            if (!conditions.min_amount && !conditions.max_amount) {
                return { required: true, workflow: wf }
            }
        }

        return { required: false }
    }

    async submitForApproval(resourceType: string, resourceId: number, requestedBy: number): Promise<any> {
        // Find matching workflow
        const { results: workflows } = await this.db.prepare(
            'SELECT * FROM approval_workflows WHERE resource_type = ? AND is_active = 1 ORDER BY id LIMIT 1'
        ).bind(resourceType.toUpperCase()).all<any>()

        if (workflows.length === 0) throw new Error(`No active workflow found for: ${resourceType}`)
        const workflow = workflows[0]

        const { meta } = await this.db.prepare(
            `INSERT INTO approval_requests (workflow_id, resource_type, resource_id, status, requested_by)
             VALUES (?, ?, ?, 'PENDING', ?)`
        ).bind(workflow.id, resourceType, resourceId, requestedBy).run()

        // Notify approvers
        const approverIds: number[] = JSON.parse(workflow.approver_ids || '[]')
        for (const approverId of approverIds) {
            await this.notificationCenter.create({
                distributorId: approverId,
                type: 'SYSTEM_ALERT',
                title: '承認リクエスト',
                message: `${resourceType} #${resourceId} の承認リクエストが届きました。`,
                relatedResourceType: 'approval',
                relatedResourceId: String(meta.last_row_id),
            })
        }

        return this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(meta.last_row_id).first()
    }

    async approve(requestId: number, approverId: number, reason?: string): Promise<any> {
        const request = await this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(requestId).first<any>()
        if (!request) throw new Error('Approval request not found')
        if (request.status !== 'PENDING') throw new Error('Request is not pending')

        await this.db.prepare(
            `UPDATE approval_requests SET status = 'APPROVED', approved_by = ?, reason = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(approverId, reason || null, requestId).run()

        // Notify requester
        await this.notificationCenter.create({
            distributorId: request.requested_by,
            type: 'SYSTEM_ALERT',
            title: '承認完了',
            message: `${request.resource_type} #${request.resource_id} が承認されました。`,
            relatedResourceType: 'approval',
            relatedResourceId: String(requestId),
        })

        return this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(requestId).first()
    }

    async reject(requestId: number, approverId: number, reason: string): Promise<any> {
        const request = await this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(requestId).first<any>()
        if (!request) throw new Error('Approval request not found')
        if (request.status !== 'PENDING') throw new Error('Request is not pending')
        if (!reason) throw new Error('Reason is required for rejection')

        await this.db.prepare(
            `UPDATE approval_requests SET status = 'REJECTED', approved_by = ?, reason = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(approverId, reason, requestId).run()

        // Notify requester
        await this.notificationCenter.create({
            distributorId: request.requested_by,
            type: 'SYSTEM_ALERT',
            title: '承認却下',
            message: `${request.resource_type} #${request.resource_id} が却下されました。理由: ${reason}`,
            relatedResourceType: 'approval',
            relatedResourceId: String(requestId),
        })

        return this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(requestId).first()
    }

    async listRequests(filters?: {
        status?: string
        resource_type?: string
        requested_by?: number
        limit?: number
        offset?: number
    }): Promise<{ requests: any[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.status) {
            where += ' AND ar.status = ?'
            params.push(filters.status.toUpperCase())
        }
        if (filters?.resource_type) {
            where += ' AND ar.resource_type = ?'
            params.push(filters.resource_type.toUpperCase())
        }
        if (filters?.requested_by) {
            where += ' AND ar.requested_by = ?'
            params.push(filters.requested_by)
        }

        const countParams = [...params]
        const sql = `SELECT ar.*, aw.name as workflow_name, d.name as requester_name
                     FROM approval_requests ar
                     LEFT JOIN approval_workflows aw ON aw.id = ar.workflow_id
                     LEFT JOIN distributors d ON d.id = ar.requested_by
                     ${where} ORDER BY ar.created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)
        const countSql = `SELECT COUNT(*) as total FROM approval_requests ar ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { requests: results, total: countResult?.total || 0 }
    }
}
