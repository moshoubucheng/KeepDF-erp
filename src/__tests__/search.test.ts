import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { SearchService } from '../services/search.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
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

// ---------------------------------------------------------------------------
// SearchService unit tests
// ---------------------------------------------------------------------------

describe('SearchService', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        // Insert customers for search tests
        await env.DB.prepare(
            `INSERT INTO customers (name, email, phone, platform, platform_customer_id, distributor_id, tags)
             VALUES ('田中太郎', 'tanaka@example.com', '090-1111-2222', 'TIKTOK', 'TT-CUST-001', 1, '[]')`
        ).run()
        await env.DB.prepare(
            `INSERT INTO customers (name, email, phone, platform, platform_customer_id, distributor_id, tags)
             VALUES ('佐藤花子', 'sato@example.com', '080-3333-4444', 'RAKUTEN', 'RK-CUST-002', 2, '[]')`
        ).run()
    })

    it('searches orders by platform_order_id', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'TT-ORD',
            distributorId: 1,
            role: 'admin',
        })
        expect(result.orders.items.length).toBeGreaterThan(0)
        expect(result.orders.items.every(i => i.type === 'order')).toBe(true)
        expect(result.orders.items[0].title).toContain('TT-ORD')
    })

    it('searches orders by SKU in order_items', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'CARROT',
            distributorId: 1,
            role: 'admin',
        })
        // Orders 1 and 5 have CARROT-500ML items
        expect(result.orders.items.length).toBeGreaterThanOrEqual(1)
    })

    it('searches products by SKU', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'MATCHA',
            distributorId: 1,
            role: 'admin',
        })
        expect(result.products.items.length).toBe(1)
        expect(result.products.items[0].title).toBe('MATCHA-100G')
    })

    it('searches products by Japanese name', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'にんじん',
            distributorId: 1,
            role: 'admin',
        })
        expect(result.products.items.length).toBe(1)
        expect(result.products.items[0].title).toBe('CARROT-500ML')
    })

    it('searches products by Chinese name', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: '抹茶',
            distributorId: 1,
            role: 'admin',
        })
        expect(result.products.items.length).toBe(1)
    })

    it('searches customers by name', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: '田中',
            distributorId: 1,
            role: 'admin',
        })
        expect(result.customers.items.length).toBe(1)
        expect(result.customers.items[0].title).toBe('田中太郎')
    })

    it('searches customers by email', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'sato@',
            distributorId: 1,
            role: 'admin',
        })
        expect(result.customers.items.length).toBe(1)
    })

    it('distributor data isolation — only own orders', async () => {
        const service = new SearchService(env.DB)
        // Distributor 2 should only see their orders (distributor_id=2)
        const result = await service.search({
            query: 'ORD',
            distributorId: 2,
            role: 'distributor',
        })
        // Seed has orders 3 & 4 for distributor 2
        for (const item of result.orders.items) {
            expect(item.meta?.platform).toBeDefined()
        }
        // Distributor 2 should NOT see distributor 1 or 3 orders
        expect(result.orders.total).toBeLessThanOrEqual(2)
    })

    it('distributor data isolation — only own customers', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: '田中',
            distributorId: 2,
            role: 'distributor',
        })
        // 田中太郎 belongs to distributor 1, so distributor 2 sees 0
        expect(result.customers.items.length).toBe(0)
    })

    it('admin sees all orders', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'ORD',
            distributorId: 1,
            role: 'admin',
        })
        // Seed has 5 orders total
        expect(result.orders.total).toBe(5)
    })

    it('type filter limits search scope', async () => {
        const service = new SearchService(env.DB)
        const result = await service.search({
            query: 'CARROT',
            types: ['product'],
            distributorId: 1,
            role: 'admin',
        })
        expect(result.products.items.length).toBe(1)
        expect(result.orders.items.length).toBe(0)
        expect(result.customers.items.length).toBe(0)
    })

    it('escapes special LIKE characters', async () => {
        const service = new SearchService(env.DB)
        // Search for literal % should not break
        const result = await service.search({
            query: '100%',
            distributorId: 1,
            role: 'admin',
        })
        // Should not throw, just return results
        expect(result.products).toBeDefined()
    })
})

// ---------------------------------------------------------------------------
// API integration tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/search', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('returns 400 for too short query', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/search?q=a', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
    })

    it('returns 400 for too long query', async () => {
        const longQ = 'x'.repeat(101)
        const res = await SELF.fetch(`http://localhost/api/v1/search?q=${longQ}`, {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(400)
    })

    it('returns search results', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/search?q=CARROT', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.orders).toBeDefined()
        expect(body.products).toBeDefined()
        expect(body.customers).toBeDefined()
        expect(body.products.items.length).toBeGreaterThan(0)
    })

    it('respects type filter', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/search?q=CARROT&type=product', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.products.items.length).toBeGreaterThan(0)
        expect(body.orders.items.length).toBe(0)
    })

    it('respects limit param', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/search?q=ORD&limit=2', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.orders.items.length).toBeLessThanOrEqual(2)
    })

    it('requires authentication', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/search?q=test')
        expect(res.status).toBe(401)
    })
})
