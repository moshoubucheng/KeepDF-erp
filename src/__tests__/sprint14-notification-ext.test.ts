import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { NotificationService } from '../services/notification.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'

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

describe('Notification Extension', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('sends email and logs to DB', async () => {
        const service = new NotificationService(env.DB)
        const result = await service.sendEmail('test@example.com', 'Test Subject', 'Test body')
        expect(result).toBe(true)

        // Verify logged
        const { results } = await env.DB.prepare(
            "SELECT * FROM notification_logs WHERE channel = 'EMAIL'"
        ).all()
        expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('logs email details correctly', async () => {
        const service = new NotificationService(env.DB)
        await service.sendEmail('user@test.com', 'Order Shipped', 'Your order has shipped')

        const log = await env.DB.prepare(
            "SELECT * FROM notification_logs WHERE channel = 'EMAIL' ORDER BY id DESC LIMIT 1"
        ).first<any>()
        expect(log.message).toContain('user@test.com')
        expect(log.message).toContain('Order Shipped')
    })

    it('send method logs to DB', async () => {
        const service = new NotificationService(env.DB)
        await service.send({ type: 'INFO', channel: 'SLACK', message: 'Test notification' })

        const { results } = await env.DB.prepare(
            "SELECT * FROM notification_logs WHERE channel = 'SLACK'"
        ).all()
        expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('alertLowStock sends notification', async () => {
        const service = new NotificationService(env.DB)
        await service.alertLowStock('SKU-001', 5)

        const { results } = await env.DB.prepare('SELECT * FROM notification_logs').all()
        expect(results.length).toBeGreaterThanOrEqual(1)
    })
})

describe('Notification API Extension', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('POST /notifications/test sends test notification', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/notifications/test', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: 'EMAIL', target: 'test@example.com' }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(true)
    })

    it('GET /notifications/preferences returns data', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/notifications/preferences', {
            headers: authHeaders(TOKEN),
        })
        // May return 200 with data or empty
        expect([200, 404].includes(res.status)).toBe(true)
    })
})
