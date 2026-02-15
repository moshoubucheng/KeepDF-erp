import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { FinancialReportsService } from '../services/financial-reports.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
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
    // Make order 1 DELIVERED with delivered_at for P&L
    await db.prepare("UPDATE orders SET status = 'DELIVERED', delivered_at = datetime('now') WHERE id = 1").run()
    // Add a settled commission
    await db.prepare(
        `INSERT INTO commission_settlements (distributor_id, order_id, sku, platform, qty, unit_price, commission_rate, commission_amount, status, settled_at)
         VALUES (1, 1, 'CARROT-500ML', 'TIKTOK', 2, 1200, 0.05, 120, 'SETTLED', datetime('now'))`
    ).run()
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Financial Reports Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('generates P&L report', async () => {
        const service = new FinancialReportsService(env.DB)
        const pnl = await service.getPnL({
            distributorId: 1,
            role: 'admin',
            startDate: '2020-01-01',
            endDate: '2030-12-31',
        })

        expect(pnl.revenue.total).toBeGreaterThan(0)
        expect(pnl.revenue.orders).toBeGreaterThanOrEqual(1)
        expect(pnl.cogs).toBeGreaterThanOrEqual(0)
        expect(pnl.expenses.commission).toBeGreaterThanOrEqual(0)
        expect(pnl.period.start).toBe('2020-01-01')
    })

    it('P&L calculates net profit correctly', async () => {
        const service = new FinancialReportsService(env.DB)
        const pnl = await service.getPnL({
            distributorId: 1,
            role: 'admin',
            startDate: '2020-01-01',
            endDate: '2030-12-31',
        })

        const expectedNet = pnl.gross_profit - pnl.expenses.commission - pnl.expenses.refunds
        expect(pnl.net_profit).toBe(expectedNet)
    })

    it('tax summary breaks down by rate', async () => {
        const service = new FinancialReportsService(env.DB)
        const summary = await service.getTaxSummary({
            distributorId: 1,
            role: 'admin',
            startDate: '2020-01-01',
            endDate: '2030-12-31',
        })

        expect(summary.breakdown).toBeInstanceOf(Array)
        expect(summary.total_tax).toBeGreaterThanOrEqual(0)
        expect(summary.total_taxable).toBeGreaterThanOrEqual(0)
    })

    it('reconciliation shows transaction types', async () => {
        const service = new FinancialReportsService(env.DB)
        const recon = await service.getReconciliation({
            distributorId: 1,
            role: 'admin',
            startDate: '2020-01-01',
            endDate: '2030-12-31',
        })

        expect(recon.transactions).toBeInstanceOf(Array)
        expect(recon.transactions.length).toBeGreaterThan(0)
        expect(recon.current_balance).toBeGreaterThanOrEqual(0)
    })

    it('balance sheet shows assets and liabilities', async () => {
        const service = new FinancialReportsService(env.DB)
        const bs = await service.getBalanceSheet({
            distributorId: 1,
            role: 'admin',
        })

        expect(bs.assets).toBeDefined()
        expect(bs.assets.cash).toBeGreaterThanOrEqual(0)
        expect(bs.assets.inventory).toBeGreaterThanOrEqual(0)
        expect(bs.liabilities).toBeDefined()
        expect(bs.equity).toBe(bs.assets.total - bs.liabilities.total)
        expect(bs.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('P&L respects data isolation for distributors', async () => {
        const service = new FinancialReportsService(env.DB)
        const dist2Pnl = await service.getPnL({
            distributorId: 2,
            role: 'distributor',
            startDate: '2020-01-01',
            endDate: '2030-12-31',
        })

        // Dist2 has no DELIVERED orders in seed data
        expect(dist2Pnl.revenue.total).toBe(0)
    })
})

describe('Financial Reports Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('GET /financial-reports/pnl returns P&L', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl?start_date=2020-01-01&end_date=2030-12-31', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.revenue).toBeDefined()
        expect(data.net_profit).toBeDefined()
    })

    it('GET /financial-reports/tax-summary returns tax data', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/financial-reports/tax-summary?start_date=2020-01-01&end_date=2030-12-31', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.breakdown).toBeInstanceOf(Array)
    })

    it('GET /financial-reports/reconciliation returns wallet reconciliation', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/financial-reports/reconciliation?start_date=2020-01-01&end_date=2030-12-31', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.transactions).toBeInstanceOf(Array)
    })

    it('GET /financial-reports/balance-sheet returns balance sheet', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/financial-reports/balance-sheet', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.assets).toBeDefined()
        expect(data.liabilities).toBeDefined()
        expect(data.equity).toBeDefined()
    })

    it('GET /financial-reports/pnl/export returns CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl/export?start_date=2020-01-01&end_date=2030-12-31', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/financial-reports/pnl')
        expect(res.status).toBe(401)
    })
})
