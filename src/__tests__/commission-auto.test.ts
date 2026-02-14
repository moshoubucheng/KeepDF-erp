import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'
import { CommissionService } from '../services/commission.service'

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

describe('Commission Auto-Settle', () => {
    let service: CommissionService

    beforeEach(async () => {
        await setupDB(env.DB)
        service = new CommissionService(env.DB)
    })

    describe('autoSettleOrder', () => {
        it('creates SETTLED records for order with commission rates', async () => {
            // Order 1: TIKTOK, distributor 1
            // Items: CARROT-500ML qty 2 price 1200, GRAPE-500ML qty 1 price 1500
            await service.autoSettleOrder(1)

            const { results } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = 1 AND status = 'SETTLED' ORDER BY sku"
            ).all()

            expect(results).toHaveLength(2)

            const carrot = results.find((r: any) => r.sku === 'CARROT-500ML') as any
            expect(carrot).toBeDefined()
            expect(carrot.distributor_id).toBe(1)
            expect(carrot.platform).toBe('TIKTOK')
            expect(carrot.qty).toBe(2)
            expect(carrot.unit_price).toBe(1200)
            expect(carrot.commission_rate).toBe(0.05)
            expect(carrot.status).toBe('SETTLED')
            expect(carrot.settled_at).toBeTruthy()

            const grape = results.find((r: any) => r.sku === 'GRAPE-500ML') as any
            expect(grape).toBeDefined()
            expect(grape.distributor_id).toBe(1)
            expect(grape.platform).toBe('TIKTOK')
            expect(grape.qty).toBe(1)
            expect(grape.unit_price).toBe(1500)
            expect(grape.commission_rate).toBe(0.05)
        })

        it('creates correct commission amounts using Math.floor', async () => {
            await service.autoSettleOrder(1)

            const { results } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = 1 ORDER BY sku"
            ).all()

            const carrot = results.find((r: any) => r.sku === 'CARROT-500ML') as any
            const grape = results.find((r: any) => r.sku === 'GRAPE-500ML') as any

            // CARROT: Math.floor(1200 * 2 * 0.05) = 120
            expect(carrot.commission_amount).toBe(120)
            // GRAPE: Math.floor(1500 * 1 * 0.05) = 75
            expect(grape.commission_amount).toBe(75)
        })

        it('is idempotent — calling twice does not create duplicates', async () => {
            await service.autoSettleOrder(1)
            await service.autoSettleOrder(1)

            const { results } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = 1 AND status = 'SETTLED'"
            ).all()

            // Should still only have 2 records (CARROT + GRAPE), not 4
            expect(results).toHaveLength(2)
        })

        it('does nothing for order with no matching commission rates', async () => {
            // Create an order with a SKU that has no commission rate for its platform
            await env.DB.prepare(
                "INSERT INTO orders (platform, platform_order_id, status, total_amount, tax_total, distributor_id) VALUES ('TEMU', 'TM-TEST-001', 'DELIVERED', 2800, 224, 1)"
            ).run()
            const order = await env.DB.prepare(
                "SELECT id FROM orders WHERE platform_order_id = 'TM-TEST-001'"
            ).first<{ id: number }>()
            await env.DB.prepare(
                "INSERT INTO order_items (order_id, sku, qty, unit_price, tax_rate) VALUES (?, 'RICE-5KG', 1, 2800, 0.08)"
            ).bind(order!.id).run()

            // RICE-5KG has no TEMU commission rate (only RAKUTEN 0.04)
            await service.autoSettleOrder(order!.id)

            const { results } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = ?"
            ).bind(order!.id).all()

            expect(results).toHaveLength(0)
        })

        it('silently returns for non-existent order', async () => {
            // Should not throw
            await service.autoSettleOrder(99999)

            const { results } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = 99999"
            ).all()
            expect(results).toHaveLength(0)
        })

        it('manual settleCommissions still works independently', async () => {
            // First auto-settle order 1
            await service.autoSettleOrder(1)

            // Manual settle order 2 (TEMU, FACE-MASK-30) should still work
            const result = await service.settleCommissions(1, [2])
            expect(result.settled).toBe(1)
            expect(result.totalAmount).toBe(760) // Math.floor(3800 * 2 * 0.10)

            // Auto-settled order 1 records should still exist
            const { results: order1Settlements } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = 1 AND status = 'SETTLED'"
            ).all()
            expect(order1Settlements).toHaveLength(2)

            // Manual-settled order 2 records should exist too
            const { results: order2Settlements } = await env.DB.prepare(
                "SELECT * FROM commission_settlements WHERE order_id = 2 AND status = 'SETTLED'"
            ).all()
            expect(order2Settlements).toHaveLength(1)
        })
    })
})
