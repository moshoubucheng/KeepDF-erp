import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { CurrencyService } from '../services/currency.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
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
    // Seed exchange rates
    await db.prepare(`INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
        ('USD', 'JPY', 149.50), ('CNY', 'JPY', 20.60),
        ('JPY', 'USD', 0.00669), ('JPY', 'CNY', 0.04854),
        ('USD', 'CNY', 7.26), ('CNY', 'USD', 0.1378)`).run()
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Currency Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('getRates() returns all exchange rates', async () => {
        const service = new CurrencyService(env.DB)
        const rates = await service.getRates()
        expect(rates.length).toBe(6)
    })

    it('setRate() creates/updates a rate', async () => {
        const service = new CurrencyService(env.DB)
        const rate = await service.setRate('USD', 'JPY', 150.00, 1)
        expect(rate.rate).toBe(150.00)
        expect(rate.from_currency).toBe('USD')
        expect(rate.to_currency).toBe('JPY')
    })

    it('convert() USD to JPY', async () => {
        const service = new CurrencyService(env.DB)
        const result = await service.convert(100, 'USD', 'JPY')
        expect(result.amount).toBe(100)
        expect(result.rate).toBe(149.50)
        expect(result.converted).toBe(14950) // Math.floor
    })

    it('toJPY() from CNY', async () => {
        const service = new CurrencyService(env.DB)
        const result = await service.toJPY(100, 'CNY')
        expect(result.jpyAmount).toBe(2060) // 100 * 20.60 = 2060
        expect(result.rate).toBe(20.60)
    })

    it('toJPY() identity for JPY', async () => {
        const service = new CurrencyService(env.DB)
        const result = await service.toJPY(1000, 'JPY')
        expect(result.jpyAmount).toBe(1000)
        expect(result.rate).toBe(1.0)
    })

    it('convert() throws for missing rate', async () => {
        const service = new CurrencyService(env.DB)
        // Delete a rate to test
        await env.DB.prepare("DELETE FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'JPY'").run()
        await expect(service.convert(100, 'USD', 'JPY')).rejects.toThrow('Exchange rate not found')
    })
})

describe('Currency Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('GET /currency/rates returns rates', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/currency/rates', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.rates.length).toBe(6)
    })

    it('GET /currency/convert works', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/currency/convert?amount=100&from=USD&to=JPY', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.converted).toBe(14950)
    })

    it('POST /currency/rates requires admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/currency/rates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'USD', to: 'JPY', rate: 150 }),
        })
        expect(res.status).toBe(403)
    })

    it('POST /currency/rates sets rate as admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/currency/rates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'USD', to: 'JPY', rate: 152.00 }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.rate.rate).toBe(152.00)
    })
})
