import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { AuditService } from '../services/audit.service'

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

describe('Audit Recovery Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('logs with snapshot', async () => {
        const service = new AuditService(env.DB)
        await service.logWithSnapshot({
            distributorId: 1, action: 'UPDATE_ORDER',
            resourceType: 'order', resourceId: '1',
        }, { status: 'pending' }, { status: 'shipped' })

        const { logs } = await service.query({ action: 'UPDATE_ORDER' })
        expect(logs.length).toBeGreaterThanOrEqual(1)
    })

    it('retrieves snapshot data', async () => {
        const service = new AuditService(env.DB)
        await service.logWithSnapshot({
            distributorId: 1, action: 'UPDATE_ORDER',
            resourceType: 'order', resourceId: '1',
        }, { status: 'pending', total: 5000 }, { status: 'shipped', total: 5000 })

        const { logs } = await service.query({ action: 'UPDATE_ORDER' })
        const snapshot = await service.getSnapshot(logs[0].id)
        expect(snapshot).toBeTruthy()
        expect(JSON.parse(snapshot.before_data)).toEqual({ status: 'pending', total: 5000 })
        expect(JSON.parse(snapshot.after_data)).toEqual({ status: 'shipped', total: 5000 })
    })

    it('stores null snapshots when no data', async () => {
        const service = new AuditService(env.DB)
        await service.logWithSnapshot({
            distributorId: 1, action: 'CREATE_ORDER',
            resourceType: 'order', resourceId: '1',
        }, null, { status: 'pending' })

        const { logs } = await service.query({ action: 'CREATE_ORDER' })
        const snapshot = await service.getSnapshot(logs[0].id)
        expect(snapshot.before_data).toBeNull()
        expect(snapshot.after_data).toBeTruthy()
    })

    it('returns null for non-existent snapshot', async () => {
        const service = new AuditService(env.DB)
        const snapshot = await service.getSnapshot(99999)
        expect(snapshot).toBeNull()
    })

    it('creates multiple snapshots for different logs', async () => {
        const service = new AuditService(env.DB)
        await service.logWithSnapshot(
            { distributorId: 1, action: 'UPDATE_ORDER', resourceType: 'order', resourceId: '1' },
            { name: 'old1' }, { name: 'new1' }
        )
        await service.logWithSnapshot(
            { distributorId: 1, action: 'UPDATE_PRODUCT', resourceType: 'product', resourceId: '2' },
            { name: 'old2' }, { name: 'new2' }
        )

        const { logs } = await service.query({})
        const snapshots = await Promise.all(logs.map(l => service.getSnapshot(l.id)))
        const withSnapshot = snapshots.filter(s => s !== null)
        expect(withSnapshot.length).toBe(2)
    })
})

describe('Audit Recovery API', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('GET /audit-recovery/restorable lists logs with snapshots', async () => {
        // Create a log with snapshot first
        const auditService = new AuditService(env.DB)
        await auditService.logWithSnapshot(
            { distributorId: 1, action: 'UPDATE_ORDER', resourceType: 'order', resourceId: '1' },
            { status: 'pending' }, { status: 'shipped' }
        )

        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/audit-recovery/restorable', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.logs.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /audit-recovery/restorable requires admin', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/audit-recovery/restorable', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(403)
    })

    it('GET /audit-recovery/snapshots/:logId returns snapshot', async () => {
        const auditService = new AuditService(env.DB)
        await auditService.logWithSnapshot(
            { distributorId: 1, action: 'UPDATE_ORDER', resourceType: 'order', resourceId: '1' },
            { status: 'pending' }, { status: 'shipped' }
        )
        const { logs } = await auditService.query({ action: 'UPDATE_ORDER' })

        const res = await SELF.fetch(`https://erp.keepdf.com/api/v1/audit-recovery/snapshots/${logs[0].id}`, {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.snapshot.before_data).toBeTruthy()
        expect(data.snapshot.after_data).toBeTruthy()
    })
})
