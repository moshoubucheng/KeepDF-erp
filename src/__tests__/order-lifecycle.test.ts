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

// Fix distributor balances to match wallet_transactions in seed data
// Seed inserts transactions but doesn't update distributor balance/frozen_balance accordingly
async function fixDistributorBalances(db: D1Database) {
    // Distributor 1: DEPOSIT 500000, FREEZE 4800 (order1), DEDUCT 4800 (order1), FREEZE 7600 (order2)
    // → balance = 500000 - 4800 - 7600 = 487600, frozen = 7600
    await db.prepare('UPDATE distributors SET balance = 487600, frozen_balance = 7600 WHERE id = 1').run()
    // Distributor 2: DEPOSIT 350000, FREEZE 5600 (order3), FREEZE 3800 (order4)
    // → balance = 350000 - 5600 - 3800 = 340600, frozen = 9400
    await db.prepare('UPDATE distributors SET balance = 340600, frozen_balance = 9400 WHERE id = 2').run()
    // Distributor 3: DEPOSIT 110000, FREEZE 2400 (order5)
    // → balance = 110000 - 2400 = 107600, frozen = 2400
    await db.prepare('UPDATE distributors SET balance = 107600, frozen_balance = 2400 WHERE id = 3').run()
}

describe('Order Lifecycle', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await fixDistributorBalances(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('PATCH /api/v1/orders/:id/deliver', () => {
        it('SHIPPED → DELIVERED returns 200', async () => {
            // Order 2: SHIPPED, distributor_id=1
            const res = await SELF.fetch('http://localhost/api/v1/orders/2/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.order.status).toBe('DELIVERED')
        })

        it('delivered_at is populated after delivery', async () => {
            await SELF.fetch('http://localhost/api/v1/orders/2/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            const order = await env.DB.prepare('SELECT * FROM orders WHERE id = 2').first<any>()
            expect(order!.delivered_at).not.toBeNull()
        })

        it('wallet deduct triggered — frozen_balance decreases', async () => {
            const before = await env.DB.prepare('SELECT frozen_balance FROM distributors WHERE id = 1').first<any>()

            await SELF.fetch('http://localhost/api/v1/orders/2/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })

            const after = await env.DB.prepare('SELECT frozen_balance FROM distributors WHERE id = 1').first<any>()
            // Order 2 freeze was 7600, so frozen should decrease by 7600
            expect(after!.frozen_balance).toBe(before!.frozen_balance - 7600)
        })

        it('DEDUCT wallet transaction created', async () => {
            await SELF.fetch('http://localhost/api/v1/orders/2/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })

            const tx = await env.DB.prepare(
                "SELECT * FROM wallet_transactions WHERE distributor_id = 1 AND type = 'DEDUCT' AND related_order_id = '2'"
            ).first<any>()
            expect(tx).not.toBeNull()
            expect(tx!.amount).toBe(7600)
        })

        it('non-SHIPPED order returns 400', async () => {
            // Order 4: PENDING
            const res = await SELF.fetch('http://localhost/api/v1/orders/4/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toContain('SHIPPED')
        })

        it('non-admin returns 403', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/2/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('non-existent order returns 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/999/deliver', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })

    describe('PATCH /api/v1/orders/:id/cancel', () => {
        it('PENDING → CANCELLED returns 200', async () => {
            // Order 4: PENDING, distributor_id=2 (matches TOKEN_2)
            const res = await SELF.fetch('http://localhost/api/v1/orders/4/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.order.status).toBe('CANCELLED')
        })

        it('cancelled_at is populated after cancellation', async () => {
            await SELF.fetch('http://localhost/api/v1/orders/4/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })
            const order = await env.DB.prepare('SELECT * FROM orders WHERE id = 4').first<any>()
            expect(order!.cancelled_at).not.toBeNull()
        })

        it('frozen amount refunded — balance restored', async () => {
            const before = await env.DB.prepare('SELECT balance, frozen_balance FROM distributors WHERE id = 2').first<any>()

            await SELF.fetch('http://localhost/api/v1/orders/4/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })

            const after = await env.DB.prepare('SELECT balance, frozen_balance FROM distributors WHERE id = 2').first<any>()
            // Order 4 freeze was 3800
            expect(after!.balance).toBe(before!.balance + 3800)
            expect(after!.frozen_balance).toBe(before!.frozen_balance - 3800)
        })

        it('REFUND wallet transaction created', async () => {
            await SELF.fetch('http://localhost/api/v1/orders/4/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })

            const tx = await env.DB.prepare(
                "SELECT * FROM wallet_transactions WHERE distributor_id = 2 AND type = 'REFUND' AND related_order_id = '4'"
            ).first<any>()
            expect(tx).not.toBeNull()
            expect(tx!.amount).toBe(3800)
        })

        it('PROCESSING → CANCELLED by admin returns 200', async () => {
            // Order 3: PROCESSING, distributor_id=2 — admin can cancel any
            const res = await SELF.fetch('http://localhost/api/v1/orders/3/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.order.status).toBe('CANCELLED')
        })

        it('SHIPPED order cannot be cancelled — returns 400', async () => {
            // Order 2: SHIPPED
            const res = await SELF.fetch('http://localhost/api/v1/orders/2/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(400)
            const data = await res.json() as any
            expect(data.error).toContain('PENDING or PROCESSING')
        })

        it('non-owner non-admin cannot cancel — returns 403', async () => {
            // Order 2 belongs to distributor 1, try cancel with TOKEN_2 (distributor 2, non-admin)
            const res = await SELF.fetch('http://localhost/api/v1/orders/2/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })

        it('already CANCELLED order returns 400', async () => {
            // Cancel order 4 first
            await SELF.fetch('http://localhost/api/v1/orders/4/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })
            // Try again
            const res = await SELF.fetch('http://localhost/api/v1/orders/4/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(400)
        })

        it('non-existent order returns 404', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/orders/999/cancel', {
                method: 'PATCH',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })
})
