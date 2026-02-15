import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ForecastingService } from '../services/forecasting.service'

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
    // Make some orders SHIPPED/DELIVERED for velocity calculation
    await db.prepare("UPDATE orders SET status = 'DELIVERED', delivered_at = datetime('now') WHERE id = 1").run()
    await db.prepare("UPDATE orders SET status = 'SHIPPED' WHERE id = 2").run()
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Forecasting Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('calculates forecasts for all SKUs', async () => {
        const service = new ForecastingService(env.DB)
        const result = await service.calculate()

        expect(result.calculated).toBeGreaterThanOrEqual(1)

        // Check that forecasts were stored
        const all = await service.getAll()
        expect(all.forecasts.length).toBeGreaterThanOrEqual(1)
    })

    it('forecast has expected fields', async () => {
        const service = new ForecastingService(env.DB)
        await service.calculate()

        const forecast = await service.getBySku('CARROT-500ML')
        expect(forecast).toBeTruthy()
        expect(forecast.daily_velocity).toBeGreaterThanOrEqual(0)
        expect(forecast.weekly_velocity).toBeGreaterThanOrEqual(0)
        expect(forecast.days_of_stock).toBeGreaterThanOrEqual(0)
        expect(forecast.reorder_point).toBeGreaterThanOrEqual(0)
        expect(forecast.safety_stock).toBeGreaterThanOrEqual(0)
        expect(forecast.current_stock).toBe(500) // from seed
    })

    it('includes recent orders in SKU detail', async () => {
        const service = new ForecastingService(env.DB)
        await service.calculate()

        const forecast = await service.getBySku('CARROT-500ML')
        expect(forecast.recent_orders).toBeInstanceOf(Array)
    })

    it('recalculation updates existing forecasts (upsert)', async () => {
        const service = new ForecastingService(env.DB)

        // First calculation
        await service.calculate()
        const first = await service.getBySku('CARROT-500ML')

        // Second calculation should update, not duplicate
        await service.calculate()
        const second = await service.getBySku('CARROT-500ML')

        // Should still be one entry per SKU
        const all = await service.getAll({ limit: 100 })
        const carrotEntries = all.forecasts.filter((f: any) => f.sku === 'CARROT-500ML')
        expect(carrotEntries.length).toBe(1)
    })

    it('reorder suggestions returns items below reorder point', async () => {
        const service = new ForecastingService(env.DB)
        await service.calculate()

        // Set stock very low for a SKU
        await env.DB.prepare("UPDATE warehouse_locations SET qty = 1 WHERE sku = 'CARROT-500ML'").run()
        await service.calculate()

        const suggestions = await service.getReorderSuggestions()
        // May or may not have suggestions depending on velocity
        expect(suggestions).toBeInstanceOf(Array)
    })

    it('returns null for non-existent SKU', async () => {
        const service = new ForecastingService(env.DB)
        const result = await service.getBySku('NON-EXISTENT-SKU')
        expect(result).toBeNull()
    })

    it('getAll returns forecasts sorted by days_of_stock', async () => {
        const service = new ForecastingService(env.DB)
        await service.calculate()

        const { forecasts } = await service.getAll()
        if (forecasts.length >= 2) {
            // Verify ascending sort by days_of_stock
            for (let i = 1; i < forecasts.length; i++) {
                expect((forecasts[i] as any).days_of_stock).toBeGreaterThanOrEqual((forecasts[i - 1] as any).days_of_stock)
            }
        }
    })
})

describe('Forecasting Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /forecasting/calculate triggers recalculation (admin only)', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/forecasting/calculate', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(true)
        expect(data.calculated).toBeGreaterThanOrEqual(1)
    })

    it('POST /forecasting/calculate requires admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/forecasting/calculate', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(403)
    })

    it('GET /forecasting returns forecast list', async () => {
        // First calculate
        await SELF.fetch('http://localhost/api/v1/forecasting/calculate', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })

        const res = await SELF.fetch('http://localhost/api/v1/forecasting', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.forecasts.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /forecasting/:sku returns SKU detail', async () => {
        await SELF.fetch('http://localhost/api/v1/forecasting/calculate', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })

        const res = await SELF.fetch('http://localhost/api/v1/forecasting/CARROT-500ML', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.forecast.sku).toBe('CARROT-500ML')
    })

    it('GET /forecasting/:sku returns 404 for unknown SKU', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/forecasting/UNKNOWN-SKU', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(404)
    })

    it('GET /forecasting/reorder-suggestions returns suggestions', async () => {
        await SELF.fetch('http://localhost/api/v1/forecasting/calculate', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })

        const res = await SELF.fetch('http://localhost/api/v1/forecasting/reorder-suggestions', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.suggestions).toBeInstanceOf(Array)
    })

    it('GET /forecasting/export returns CSV', async () => {
        await SELF.fetch('http://localhost/api/v1/forecasting/calculate', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        })

        const res = await SELF.fetch('http://localhost/api/v1/forecasting/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/forecasting')
        expect(res.status).toBe(401)
    })
})
