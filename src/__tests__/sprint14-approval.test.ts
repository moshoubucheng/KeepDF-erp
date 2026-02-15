import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ApprovalService } from '../services/approval.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'
const TOKEN_2 = 'tok_dev_def456'

const TABLE_NAMES = [
    'dashboard_layouts', 'webhook_logs', 'webhook_endpoints', 'audit_snapshots',
    'approval_requests', 'approval_workflows', 'promotions', 'customer_segments',
    'stocktake_items', 'stocktakes', 'shipping_fees', 'shipping_fee_templates',
    'coupon_usage', 'coupons', 'shipment_events', 'exchange_rates',
    'automation_logs', 'automation_rules',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
]

async function setupDB(db: D1Database) {
    for (const table of TABLE_NAMES) { await db.prepare(`DROP TABLE IF EXISTS ${table}`).run() }
    for (const stmt of schemaSQL.split(';')) { const t = stmt.trim(); if (t) await db.prepare(t).run() }
    for (const stmt of seedSQL.split(';')) { const t = stmt.trim(); if (t) await db.prepare(t).run() }
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Approval Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates a workflow', async () => {
        const service = new ApprovalService(env.DB)
        const wf = await service.createWorkflow({
            name: 'Large PO Approval', resource_type: 'PURCHASE_ORDER',
            conditions: { min_amount: 100000 }, approver_ids: [1],
        })
        expect(wf.name).toBe('Large PO Approval')
        expect(wf.resource_type).toBe('PURCHASE_ORDER')
    })

    it('lists workflows', async () => {
        const service = new ApprovalService(env.DB)
        await service.createWorkflow({ name: 'W1', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] })
        await service.createWorkflow({ name: 'W2', resource_type: 'RETURN_REFUND', conditions: {}, approver_ids: [1] })
        const all = await service.listWorkflows()
        expect(all.length).toBe(2)
        const filtered = await service.listWorkflows({ resource_type: 'RETURN_REFUND' })
        expect(filtered.length).toBe(1)
    })

    it('updates a workflow', async () => {
        const service = new ApprovalService(env.DB)
        const wf = await service.createWorkflow({ name: 'W', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] })
        const updated = await service.updateWorkflow(wf.id, { name: 'Updated Workflow' })
        expect(updated.name).toBe('Updated Workflow')
    })

    it('deletes a workflow', async () => {
        const service = new ApprovalService(env.DB)
        const wf = await service.createWorkflow({ name: 'W', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] })
        const deleted = await service.deleteWorkflow(wf.id)
        expect(deleted).toBe(true)
        const all = await service.listWorkflows()
        expect(all.length).toBe(0)
    })

    it('checks if approval is required', async () => {
        const service = new ApprovalService(env.DB)
        await service.createWorkflow({
            name: 'Big PO', resource_type: 'PURCHASE_ORDER',
            conditions: { min_amount: 50000 }, approver_ids: [1],
        })
        const { required: yes } = await service.checkRequiresApproval('PURCHASE_ORDER', 100000)
        expect(yes).toBe(true)
        const { required: no } = await service.checkRequiresApproval('PURCHASE_ORDER', 10000)
        expect(no).toBe(false)
    })

    it('submits for approval', async () => {
        const service = new ApprovalService(env.DB)
        await service.createWorkflow({
            name: 'PO Approval', resource_type: 'PURCHASE_ORDER',
            conditions: {}, approver_ids: [1],
        })
        const req = await service.submitForApproval('PURCHASE_ORDER', 1, 2)
        expect(req.status).toBe('PENDING')
        expect(req.resource_type).toBe('PURCHASE_ORDER')
        expect(req.requested_by).toBe(2)
    })

    it('approves a request', async () => {
        const service = new ApprovalService(env.DB)
        await service.createWorkflow({ name: 'W', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] })
        const req = await service.submitForApproval('PURCHASE_ORDER', 1, 2)
        const approved = await service.approve(req.id, 1, 'Looks good')
        expect(approved.status).toBe('APPROVED')
        expect(approved.approved_by).toBe(1)
    })

    it('rejects a request with reason', async () => {
        const service = new ApprovalService(env.DB)
        await service.createWorkflow({ name: 'W', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] })
        const req = await service.submitForApproval('PURCHASE_ORDER', 1, 2)
        const rejected = await service.reject(req.id, 1, 'Too expensive')
        expect(rejected.status).toBe('REJECTED')
        expect(rejected.reason).toBe('Too expensive')
    })

    it('rejects rejection without reason', async () => {
        const service = new ApprovalService(env.DB)
        await service.createWorkflow({ name: 'W', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] })
        const req = await service.submitForApproval('PURCHASE_ORDER', 1, 2)
        await expect(service.reject(req.id, 1, '')).rejects.toThrow('Reason is required')
    })

    it('rejects invalid resource type', async () => {
        const service = new ApprovalService(env.DB)
        await expect(service.createWorkflow({
            name: 'W', resource_type: 'INVALID', conditions: {}, approver_ids: [1],
        })).rejects.toThrow('Invalid resource_type')
    })
})

describe('Approval API', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('POST /approvals/workflows requires admin', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/approvals/workflows', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'W', resource_type: 'PURCHASE_ORDER', conditions: {}, approver_ids: [1] }),
        })
        expect(res.status).toBe(403)
    })
})
