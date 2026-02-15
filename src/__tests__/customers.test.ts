import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { CustomerService } from '../services/customer.service'

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

describe('Customer Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('create() inserts a customer', async () => {
        const service = new CustomerService(env.DB)
        const customer = await service.create({
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '090-1234-5678',
            distributor_id: 1,
        })

        expect(customer.id).toBeTruthy()
        expect(customer.name).toBe('Test Customer')
        expect(customer.email).toBe('test@example.com')
        expect(customer.country).toBe('JP')
    })

    it('list() returns customers with pagination', async () => {
        const service = new CustomerService(env.DB)
        await service.create({ name: 'Customer A', distributor_id: 1 })
        await service.create({ name: 'Customer B', distributor_id: 1 })
        await service.create({ name: 'Customer C', distributor_id: 2 })

        // Admin sees all
        const { customers, total } = await service.list({ distributorId: 1, role: 'admin' })
        expect(customers.length).toBe(3)
        expect(total).toBe(3)

        // Distributor sees only own
        const dist2 = await service.list({ distributorId: 2, role: 'distributor' })
        expect(dist2.customers.length).toBe(1)
        expect(dist2.total).toBe(1)
    })

    it('list() supports search', async () => {
        const service = new CustomerService(env.DB)
        await service.create({ name: 'Tanaka Taro', email: 'tanaka@test.com', distributor_id: 1 })
        await service.create({ name: 'Suzuki Jiro', email: 'suzuki@test.com', distributor_id: 1 })

        const result = await service.list({ distributorId: 1, role: 'admin', search: 'tanaka' })
        expect(result.customers.length).toBe(1)
        expect(result.customers[0].name).toBe('Tanaka Taro')
    })

    it('list() supports tag filter', async () => {
        const service = new CustomerService(env.DB)
        await service.create({ name: 'VIP', tags: ['vip', 'repeat'], distributor_id: 1 })
        await service.create({ name: 'Normal', tags: ['new'], distributor_id: 1 })

        const result = await service.list({ distributorId: 1, role: 'admin', tag: 'vip' })
        expect(result.customers.length).toBe(1)
        expect(result.customers[0].name).toBe('VIP')
    })

    it('getDetail() returns customer with stats', async () => {
        const service = new CustomerService(env.DB)
        const customer = await service.create({ name: 'Stats Test', distributor_id: 1 })

        const detail = await service.getDetail(customer.id, 1, 'admin')
        expect(detail).toBeTruthy()
        expect(detail.name).toBe('Stats Test')
        expect(detail.order_count).toBe(0)
        expect(detail.total_spent).toBe(0)
    })

    it('getDetail() returns null for non-existent customer', async () => {
        const service = new CustomerService(env.DB)
        const detail = await service.getDetail(9999, 1, 'admin')
        expect(detail).toBeNull()
    })

    it('update() updates allowed fields', async () => {
        const service = new CustomerService(env.DB)
        const customer = await service.create({ name: 'Original', distributor_id: 1 })

        const updated = await service.update(customer.id, 1, 'admin', {
            name: 'Updated',
            email: 'updated@test.com',
            tags: ['vip'],
        })

        expect(updated.name).toBe('Updated')
        expect(updated.email).toBe('updated@test.com')
        expect(JSON.parse(updated.tags)).toEqual(['vip'])
    })

    it('update() respects data isolation', async () => {
        const service = new CustomerService(env.DB)
        const customer = await service.create({ name: 'Dist1 Customer', distributor_id: 1 })

        // Dist2 cannot update dist1's customer
        const result = await service.update(customer.id, 2, 'distributor', { name: 'Hacked' })
        expect(result).toBeNull()
    })
})

describe('Customers Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /customers creates a customer', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'New Customer', email: 'new@test.com' }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.customer.name).toBe('New Customer')
    })

    it('POST /customers validates name', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'no-name@test.com' }),
        })
        expect(res.status).toBe(400)
    })

    it('GET /customers returns list', async () => {
        // Create a customer first
        await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'List Test' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/customers', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.customers.length).toBeGreaterThanOrEqual(1)
        expect(data.total).toBeGreaterThanOrEqual(1)
    })

    it('GET /customers/:id returns detail', async () => {
        const createRes = await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Detail Test' }),
        })
        const { customer } = await createRes.json() as any

        const res = await SELF.fetch(`http://localhost/api/v1/customers/${customer.id}`, {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.customer.name).toBe('Detail Test')
        expect(data.customer.order_count).toBe(0)
    })

    it('GET /customers/:id returns 404 for non-existent', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customers/99999', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(404)
    })

    it('PUT /customers/:id updates customer', async () => {
        const createRes = await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Before Update' }),
        })
        const { customer } = await createRes.json() as any

        const res = await SELF.fetch(`http://localhost/api/v1/customers/${customer.id}`, {
            method: 'PUT',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'After Update', phone: '03-1234-5678' }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.customer.name).toBe('After Update')
        expect(data.customer.phone).toBe('03-1234-5678')
    })

    it('GET /customers/export returns CSV', async () => {
        await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'CSV Test' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/customers/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })

    it('data isolation: dist2 cannot see dist1 customers', async () => {
        await SELF.fetch('http://localhost/api/v1/customers', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Admin Customer' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/customers', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.customers.length).toBe(0)
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/customers')
        expect(res.status).toBe(401)
    })
})
