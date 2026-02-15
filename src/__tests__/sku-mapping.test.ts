import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { SkuMappingService } from '../services/sku-mapping.service'

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
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('SkuMapping Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('create() creates a valid mapping', async () => {
        const service = new SkuMappingService(env.DB)
        const mapping = await service.create({
            local_sku: 'CERAMIC-MUG',
            platform: 'TIKTOK',
            platform_sku: 'TT-MUG-001',
            price_sync: 1,
        })
        expect(mapping.local_sku).toBe('CERAMIC-MUG')
        expect(mapping.platform).toBe('TIKTOK')
        expect(mapping.platform_sku).toBe('TT-MUG-001')
    })

    it('create() validates local_sku exists', async () => {
        const service = new SkuMappingService(env.DB)
        await expect(service.create({
            local_sku: 'NONEXISTENT',
            platform: 'TIKTOK',
            platform_sku: 'TT-NONE-001',
        })).rejects.toThrow('Product not found')
    })

    it('create() rejects duplicate platform_sku', async () => {
        const service = new SkuMappingService(env.DB)
        // TT-VEG-CARROT500 already exists in seed data
        await expect(service.create({
            local_sku: 'GRAPE-500ML',
            platform: 'TIKTOK',
            platform_sku: 'TT-VEG-CARROT500',
        })).rejects.toThrow() // UNIQUE constraint
    })

    it('create() rejects invalid platform', async () => {
        const service = new SkuMappingService(env.DB)
        await expect(service.create({
            local_sku: 'CERAMIC-MUG',
            platform: 'AMAZON',
            platform_sku: 'AMZ-001',
        })).rejects.toThrow('Invalid platform')
    })

    it('update() updates sync flags', async () => {
        const service = new SkuMappingService(env.DB)
        // Get first mapping from seed
        const { mappings } = await service.list({ limit: 1 })
        const updated = await service.update(mappings[0].id, { price_sync: 1, stock_sync: 1 })
        expect(updated!.price_sync).toBe(1)
        expect(updated!.stock_sync).toBe(1)
    })

    it('delete() removes a mapping', async () => {
        const service = new SkuMappingService(env.DB)
        const { mappings } = await service.list({ limit: 1 })
        const deleted = await service.delete(mappings[0].id)
        expect(deleted).toBe(true)
        const check = await service.getById(mappings[0].id)
        expect(check).toBeNull()
    })

    it('list() filters by platform', async () => {
        const service = new SkuMappingService(env.DB)
        const result = await service.list({ platform: 'TIKTOK' })
        expect(result.mappings.length).toBeGreaterThan(0)
        result.mappings.forEach(m => expect(m.platform).toBe('TIKTOK'))
    })

    it('bulkImport() imports multiple mappings', async () => {
        const service = new SkuMappingService(env.DB)
        const result = await service.bulkImport([
            { local_sku: 'CERAMIC-MUG', platform: 'TIKTOK', platform_sku: 'TT-MUG-NEW' },
            { local_sku: 'RICE-5KG', platform: 'TEMU', platform_sku: 'TEMU-RICE-NEW' },
        ])
        expect(result.imported).toBe(2)
        expect(result.errors.length).toBe(0)
    })

    it('validateMappings() identifies invalid SKUs', async () => {
        const service = new SkuMappingService(env.DB)
        // All seed data should be valid
        const result = await service.validateMappings()
        expect(result.valid).toBe(10)
        expect(result.invalid.length).toBe(0)
    })
})

describe('SkuMapping Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('GET /sku-mappings returns list', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/sku-mappings', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.mappings.length).toBeGreaterThan(0)
        expect(data.total).toBeGreaterThan(0)
    })

    it('POST /sku-mappings requires admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/sku-mappings', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_sku: 'CERAMIC-MUG', platform: 'TIKTOK', platform_sku: 'TT-TEST' }),
        })
        expect(res.status).toBe(403)
    })

    it('GET /sku-mappings/export returns CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/sku-mappings/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })
})
