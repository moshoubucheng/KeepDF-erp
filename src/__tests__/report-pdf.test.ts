import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'coupon_usage', 'coupons', 'shipment_events', 'exchange_rates',
    'automation_logs', 'automation_rules',
    'inventory_forecasts', 'message_triggers', 'customer_messages', 'message_templates',
    'price_history', 'price_rules', 'purchase_order_items', 'purchase_orders', 'suppliers',
    'return_items', 'returns',
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
    // Make order 1 DELIVERED for P&L
    await db.prepare("UPDATE orders SET status = 'DELIVERED', delivered_at = datetime('now') WHERE id = 1").run()
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Report PDF Endpoints', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('GET /api/v1/financial-reports/pnl/pdf', () => {
        it('返回 PDF content-type', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl/pdf', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toBe('application/pdf')
        })

        it('PDF 包含有效 PDF header (%PDF-1.4)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl/pdf', {
                headers: authHeaders(TOKEN),
            })
            const bytes = new Uint8Array(await res.arrayBuffer())
            const header = new TextDecoder().decode(bytes.slice(0, 8))
            expect(header).toContain('%PDF-1.4')
        })

        it('admin-only (distributor 返回 403)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl/pdf', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('带 date range 参数', async () => {
            const res = await SELF.fetch(
                'http://localhost/api/v1/financial-reports/pnl/pdf?start_date=2020-01-01&end_date=2030-12-31',
                { headers: authHeaders(TOKEN) },
            )
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toBe('application/pdf')
        })

        it('401 无认证', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl/pdf')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /api/v1/financial-reports/sales/pdf', () => {
        it('返回 PDF', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/sales/pdf', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toBe('application/pdf')
        })

        it('admin-only', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/sales/pdf', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('PDF 内容非空 (Content-Length > 0)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/sales/pdf', {
                headers: authHeaders(TOKEN),
            })
            const bytes = await res.arrayBuffer()
            expect(bytes.byteLength).toBeGreaterThan(0)
        })
    })

    describe('GET /api/v1/financial-reports/inventory/pdf', () => {
        it('返回 PDF', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/inventory/pdf', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toBe('application/pdf')
        })

        it('admin-only', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/inventory/pdf', {
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('PDF 包含有效 PDF header', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/financial-reports/inventory/pdf', {
                headers: authHeaders(TOKEN),
            })
            const bytes = new Uint8Array(await res.arrayBuffer())
            const header = new TextDecoder().decode(bytes.slice(0, 8))
            expect(header).toContain('%PDF-1.4')
        })
    })
})
