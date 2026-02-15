import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ImportService } from '../services/import.service'

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

describe('Import Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    describe('parseCSV()', () => {
        it('parses simple CSV', () => {
            const service = new ImportService(env.DB)
            const rows = service.parseCSV('name,age\nAlice,30\nBob,25')
            expect(rows.length).toBe(2)
            expect(rows[0].name).toBe('Alice')
            expect(rows[0].age).toBe('30')
            expect(rows[1].name).toBe('Bob')
        })

        it('handles quoted fields', () => {
            const service = new ImportService(env.DB)
            const rows = service.parseCSV('name,desc\n"John ""Jr""",test\n"Alice, Bob",multi')
            expect(rows.length).toBe(2)
            expect(rows[0].name).toBe('John "Jr"')
            expect(rows[1].name).toBe('Alice, Bob')
        })

        it('returns empty array for header-only CSV', () => {
            const service = new ImportService(env.DB)
            const rows = service.parseCSV('name,age')
            expect(rows.length).toBe(0)
        })

        it('handles Windows line endings', () => {
            const service = new ImportService(env.DB)
            const rows = service.parseCSV('a,b\r\n1,2\r\n3,4')
            expect(rows.length).toBe(2)
        })
    })

    describe('importProducts()', () => {
        it('imports products from CSV', async () => {
            const service = new ImportService(env.DB)
            const csv = 'sku,name_jp,name_cn,cost_price,tax_category\nNEW-SKU-1,新商品,新产品,2000,standard\nNEW-SKU-2,商品2,产品2,1500,reduced'
            const result = await service.importProducts(csv, 1)

            expect(result.total).toBe(2)
            expect(result.success).toBe(2)
            expect(result.errors.length).toBe(0)

            // Verify products exist
            const p1 = await env.DB.prepare("SELECT * FROM products WHERE sku = 'NEW-SKU-1'").first()
            expect(p1).toBeTruthy()
            expect(p1!.cost_price).toBe(2000)
        })

        it('upserts existing products', async () => {
            const service = new ImportService(env.DB)
            // CARROT-500ML already exists with cost 1200
            const csv = 'sku,name_jp,cost_price\nCARROT-500ML,Updated Name,1500'
            const result = await service.importProducts(csv, 1)

            expect(result.success).toBe(1)

            const product = await env.DB.prepare("SELECT * FROM products WHERE sku = 'CARROT-500ML'").first()
            expect(product!.cost_price).toBe(1500)
        })

        it('reports row errors without failing batch', async () => {
            const service = new ImportService(env.DB)
            const csv = 'sku,cost_price\nGOOD-SKU,1000\n,500\nBAD-PRICE,-1'
            const result = await service.importProducts(csv, 1)

            expect(result.total).toBe(3)
            expect(result.success).toBe(1)
            expect(result.errors.length).toBe(2)
        })

        it('creates import log', async () => {
            const service = new ImportService(env.DB)
            const csv = 'sku,cost_price\nLOG-SKU,500'
            await service.importProducts(csv, 1)

            const log = await env.DB.prepare(
                "SELECT * FROM import_logs WHERE type = 'PRODUCTS' ORDER BY id DESC LIMIT 1"
            ).first()
            expect(log).toBeTruthy()
            expect(log!.total_rows).toBe(1)
            expect(log!.success_count).toBe(1)
        })

        it('triggers import notification', async () => {
            const service = new ImportService(env.DB)
            const csv = 'sku,cost_price\nNOTIF-SKU,800'
            await service.importProducts(csv, 1)

            const notif = await env.DB.prepare(
                "SELECT * FROM notifications WHERE distributor_id = 1 AND type = 'IMPORT_COMPLETE'"
            ).first()
            expect(notif).toBeTruthy()
        })
    })

    describe('importOrders()', () => {
        it('imports orders from CSV', async () => {
            const service = new ImportService(env.DB)
            const csv = 'platform,platform_order_id,total_amount,tax_total,status\nTIKTOK,IMP-001,5000,500,PENDING\nTEMU,IMP-002,3000,300,PENDING'
            const result = await service.importOrders(csv, 1)

            expect(result.total).toBe(2)
            expect(result.success).toBe(2)
        })

        it('rejects invalid platform', async () => {
            const service = new ImportService(env.DB)
            const csv = 'platform,platform_order_id,total_amount\nINVALID,ORD-001,1000'
            const result = await service.importOrders(csv, 1)

            expect(result.success).toBe(0)
            expect(result.errors.length).toBe(1)
        })
    })

    describe('batchUpdateStatus()', () => {
        it('updates multiple order statuses', async () => {
            const service = new ImportService(env.DB)
            const result = await service.batchUpdateStatus(
                [
                    { order_id: 4, status: 'PROCESSING' },
                    { order_id: 5, status: 'PROCESSING' },
                ],
                1,
                'admin',
            )

            expect(result.success).toBe(2)

            const o4 = await env.DB.prepare('SELECT status FROM orders WHERE id = 4').first()
            expect(o4!.status).toBe('PROCESSING')
        })

        it('data isolation: non-admin cannot update other distributor orders', async () => {
            const service = new ImportService(env.DB)
            // Order 1 belongs to dist1, try updating as dist2
            const result = await service.batchUpdateStatus(
                [{ order_id: 1, status: 'CANCELLED' }],
                2,
                'distributor',
            )

            expect(result.success).toBe(0)
            expect(result.errors.length).toBe(1)
        })

        it('rejects invalid status', async () => {
            const service = new ImportService(env.DB)
            const result = await service.batchUpdateStatus(
                [{ order_id: 4, status: 'INVALID_STATUS' }],
                1,
                'admin',
            )

            expect(result.success).toBe(0)
            expect(result.errors.length).toBe(1)
        })
    })

    describe('getLogs()', () => {
        it('returns import logs', async () => {
            const service = new ImportService(env.DB)
            // Do an import first
            await service.importProducts('sku,cost_price\nTEST,100', 1)

            const logs = await service.getLogs(1, 'admin')
            expect(logs.length).toBeGreaterThanOrEqual(1)
        })
    })

    describe('Templates', () => {
        it('getProductTemplate() returns valid CSV', () => {
            const service = new ImportService(env.DB)
            const csv = service.getProductTemplate()
            expect(csv).toContain('sku')
            expect(csv).toContain('cost_price')
        })

        it('getOrderTemplate() returns valid CSV', () => {
            const service = new ImportService(env.DB)
            const csv = service.getOrderTemplate()
            expect(csv).toContain('platform')
            expect(csv).toContain('total_amount')
        })
    })
})

describe('Import Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /import/products imports CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/products', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: 'sku,cost_price,name_jp\nIMP-P1,999,テスト' }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(1)
    })

    it('POST /import/products rejects empty CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/products', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: '' }),
        })
        expect(res.status).toBe(400)
    })

    it('POST /import/orders imports CSV', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/orders', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: 'platform,platform_order_id,total_amount\nTIKTOK,CTL-ORD-001,5000' }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(1)
    })

    it('POST /import/batch-update updates statuses', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/batch-update', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                updates: [
                    { order_id: 4, status: 'PROCESSING' },
                ],
            }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(1)
    })

    it('POST /import/batch-update validates input', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/batch-update', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })
        expect(res.status).toBe(400)
    })

    it('GET /import/logs returns history', async () => {
        // First do an import
        await SELF.fetch('http://localhost/api/v1/import/products', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: 'sku,cost_price\nLOG-T1,100' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/import/logs', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.logs.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /import/templates/products returns CSV template', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/templates/products', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
        const text = await res.text()
        expect(text).toContain('sku')
    })

    it('GET /import/templates/orders returns CSV template', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/templates/orders', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
        const text = await res.text()
        expect(text).toContain('platform')
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/import/logs')
        expect(res.status).toBe(401)
    })
})
