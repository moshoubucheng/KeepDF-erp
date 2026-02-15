import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ShippingFeeService } from '../services/shipping-fee.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

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
    for (const table of TABLE_NAMES) {
        await db.prepare(`DROP TABLE IF EXISTS ${table}`).run()
    }
    for (const stmt of schemaSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
    for (const stmt of seedSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Shipping Fee Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates a template', async () => {
        const service = new ShippingFeeService(env.DB)
        const tpl = await service.createTemplate({
            name: 'Yamato Standard', carrier: 'YAMATO', base_fee: 800,
        }, 1)
        expect(tpl.name).toBe('Yamato Standard')
        expect(tpl.carrier).toBe('YAMATO')
        expect(tpl.base_fee).toBe(800)
    })

    it('lists templates', async () => {
        const service = new ShippingFeeService(env.DB)
        await service.createTemplate({ name: 'T1', carrier: 'YAMATO', base_fee: 500 }, 1)
        await service.createTemplate({ name: 'T2', carrier: 'SAGAWA', base_fee: 600 }, 1)
        const { templates, total } = await service.listTemplates()
        expect(total).toBe(2)
        expect(templates.length).toBe(2)
    })

    it('updates a template', async () => {
        const service = new ShippingFeeService(env.DB)
        const tpl = await service.createTemplate({ name: 'T1', carrier: 'YAMATO', base_fee: 500 }, 1)
        const updated = await service.updateTemplate(tpl.id, { base_fee: 900 }, 1)
        expect(updated.base_fee).toBe(900)
    })

    it('soft deletes a template', async () => {
        const service = new ShippingFeeService(env.DB)
        const tpl = await service.createTemplate({ name: 'T1', carrier: 'YAMATO', base_fee: 500 }, 1)
        const deleted = await service.deleteTemplate(tpl.id, 1)
        expect(deleted).toBe(true)
        const { templates } = await service.listTemplates({ is_active: 1 })
        expect(templates.length).toBe(0)
    })

    it('records a shipping fee', async () => {
        const service = new ShippingFeeService(env.DB)
        const fee = await service.recordFee(1, { carrier: 'YAMATO', actual_fee: 1200 }, 1)
        expect(fee.actual_fee).toBe(1200)
        expect(fee.carrier).toBe('YAMATO')
    })

    it('reconciles shipping fees', async () => {
        const service = new ShippingFeeService(env.DB)
        const f1 = await service.recordFee(1, { carrier: 'YAMATO', actual_fee: 800 }, 1)
        const f2 = await service.recordFee(1, { carrier: 'SAGAWA', actual_fee: 600 }, 1)
        const { reconciled } = await service.reconcile([f1.id, f2.id], 1)
        expect(reconciled).toBe(2)
    })

    it('rejects invalid carrier', async () => {
        const service = new ShippingFeeService(env.DB)
        await expect(service.createTemplate({ name: 'T', carrier: 'INVALID', base_fee: 100 }, 1))
            .rejects.toThrow('Invalid carrier')
    })
})

describe('Shipping Fee API', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('POST /shipping-fees/templates requires admin', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/shipping-fees/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'T', carrier: 'YAMATO', base_fee: 500 }),
        })
        expect(res.status).toBe(403)
    })

    it('POST /shipping-fees/templates succeeds for admin', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/shipping-fees/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Yamato', carrier: 'YAMATO', base_fee: 800 }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.name).toBe('Yamato')
    })

    it('POST /shipping-fees records fee', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/shipping-fees', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: 1, carrier: 'YAMATO', actual_fee: 1000 }),
        })
        expect(res.status).toBe(201)
    })
})
