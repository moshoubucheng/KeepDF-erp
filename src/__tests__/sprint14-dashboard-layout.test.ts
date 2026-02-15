import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { DashboardLayoutService } from '../services/dashboard-layout.service'

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

describe('Dashboard Layout Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('returns default layout when none saved', async () => {
        const service = new DashboardLayoutService(env.DB)
        const layout = await service.getLayout(1)
        expect(layout.length).toBe(5)
        expect(layout[0].widgetId).toBe('stats')
    })

    it('saves and retrieves custom layout', async () => {
        const service = new DashboardLayoutService(env.DB)
        const custom = [
            { widgetId: 'stats', order: 0, visible: true },
            { widgetId: 'ordersChart', order: 1, visible: true },
            { widgetId: 'platformDonut', order: 2, visible: false },
        ]
        await service.saveLayout(1, custom)
        const layout = await service.getLayout(1)
        expect(layout.length).toBe(3)
        expect(layout[1].widgetId).toBe('ordersChart')
        expect(layout[2].visible).toBe(false)
    })

    it('overwrites existing layout on save', async () => {
        const service = new DashboardLayoutService(env.DB)
        await service.saveLayout(1, [{ widgetId: 'stats', order: 0, visible: true }])
        await service.saveLayout(1, [{ widgetId: 'ordersChart', order: 0, visible: true }])
        const layout = await service.getLayout(1)
        expect(layout.length).toBe(1)
        expect(layout[0].widgetId).toBe('ordersChart')
    })

    it('rejects non-array layout', async () => {
        const service = new DashboardLayoutService(env.DB)
        await expect(service.saveLayout(1, 'invalid' as any)).rejects.toThrow('layout must be an array')
    })

    it('isolates layouts per distributor', async () => {
        const service = new DashboardLayoutService(env.DB)
        await service.saveLayout(1, [{ widgetId: 'stats', order: 0, visible: true }])
        const layout2 = await service.getLayout(2)
        // Distributor 2 has no saved layout, gets default
        expect(layout2.length).toBe(5)
    })
})

describe('Dashboard Layout API', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('GET /dashboard/layout returns layout', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/dashboard/layout', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(Array.isArray(data.layout)).toBe(true)
    })

    it('PUT /dashboard/layout saves layout', async () => {
        const custom = [
            { widgetId: 'stats', order: 0, visible: true },
            { widgetId: 'ordersChart', order: 1, visible: false },
        ]
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/dashboard/layout', {
            method: 'PUT',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout: custom }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.layout.length).toBe(2)
    })
})
