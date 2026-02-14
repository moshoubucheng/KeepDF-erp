import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor 1)
const TOKEN_2 = 'tok_dev_def456' // distributor 2

const TABLE_NAMES = [
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

describe('Product Management', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('PUT /api/v1/inventory/products/:id', () => {
        it('admin can update a product', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name_jp: '新にんじんジュース', cost_price: 1500 }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.product.name_jp).toBe('新にんじんジュース')
            expect(data.product.cost_price).toBe(1500)
        })

        it('rejects empty name_jp', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name_jp: '' }),
            })
            expect(res.status).toBe(400)
        })

        it('rejects cost_price <= 0', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ cost_price: -100 }),
            })
            expect(res.status).toBe(400)
        })

        it('non-admin gets 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name_jp: 'test' }),
            })
            expect(res.status).toBe(403)
        })

        it('returns 404 for non-existent product', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/999', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name_jp: 'test' }),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /api/v1/inventory/products/:id', () => {
        it('admin can delete product with no active orders', async () => {
            // Product 6 (CERAMIC-MUG) has no active orders
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/6', {
                method: 'DELETE',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.status).toBe('deleted')

            // Verify product is gone
            const product = await env.DB.prepare('SELECT * FROM products WHERE id = 6').first()
            expect(product).toBeNull()

            // Verify variants are also gone
            const variants = await env.DB.prepare('SELECT * FROM product_variants WHERE product_id = 6').all()
            expect(variants.results.length).toBe(0)
        })

        it('rejects delete when product has active orders', async () => {
            // Product 3 (FACE-MASK-30) has active orders (order 2 SHIPPED, order 4 PENDING)
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/3', {
                method: 'DELETE',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(409)
            const data = await res.json() as any
            expect(data.error).toContain('active orders')
        })

        it('non-admin gets 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/6', {
                method: 'DELETE',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })
    })

    describe('POST /api/v1/inventory/products/:id/image', () => {
        it('rejects when no file provided', async () => {
            const formData = new FormData()
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1/image', {
                method: 'POST',
                headers: authHeaders(TOKEN),
                body: formData,
            })
            expect(res.status).toBe(400)
        })

        it('rejects for non-existent product', async () => {
            const imageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47])
            const formData = new FormData()
            formData.append('image', new File([imageData], 'test.png', { type: 'image/png' }))

            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/999/image', {
                method: 'POST',
                headers: authHeaders(TOKEN),
                body: formData,
            })
            expect(res.status).toBe(404)
        })

        it('non-admin gets 403', async () => {
            const imageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47])
            const formData = new FormData()
            formData.append('image', new File([imageData], 'test.png', { type: 'image/png' }))

            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1/image', {
                method: 'POST',
                headers: authHeaders(TOKEN_2),
                body: formData,
            })
            expect(res.status).toBe(403)
        })
    })

    describe('GET /api/v1/inventory/products/:id/image', () => {
        it('returns 404 when no image exists', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1/image', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })

        it('returns 404 for non-existent product', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/999/image', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('GET /api/v1/inventory/products/:id/variants', () => {
        it('returns variants for a product', async () => {
            // Product 3 (FACE-MASK-30) has 2 variants
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/3/variants', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.variants.length).toBe(2)
        })

        it('returns 404 for non-existent product', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/999/variants', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('POST /api/v1/inventory/products/:id/variants', () => {
        it('admin can create a variant', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1/variants', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ sku: 'CARROT-500ML-LG', color: '緑', size: '500ml', stock_qty: 100 }),
            })
            expect(res.status).toBe(201)
            const data = await res.json() as any
            expect(data.variant.sku).toBe('CARROT-500ML-LG')
            expect(data.variant.product_id).toBe(1)
        })

        it('rejects variant without sku', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1/variants', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ color: 'red' }),
            })
            expect(res.status).toBe(400)
        })

        it('non-admin gets 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/products/1/variants', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
                body: JSON.stringify({ sku: 'TEST-SKU' }),
            })
            expect(res.status).toBe(403)
        })
    })

    describe('PUT /api/v1/inventory/variants/:id', () => {
        it('admin can update a variant', async () => {
            // Variant 1 is FACE-MASK-30-W
            const res = await SELF.fetch('http://localhost/api/v1/inventory/variants/1', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock_qty: 300 }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.variant.stock_qty).toBe(300)
        })

        it('returns 404 for non-existent variant', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/variants/999', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock_qty: 100 }),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /api/v1/inventory/variants/:id', () => {
        it('admin can delete a variant', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/variants/1', {
                method: 'DELETE',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.status).toBe('deleted')

            // Verify it's gone
            const variant = await env.DB.prepare('SELECT * FROM product_variants WHERE id = 1').first()
            expect(variant).toBeNull()
        })

        it('non-admin gets 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/inventory/variants/1', {
                method: 'DELETE',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })
    })
})
