import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { ShippingService } from '../services/shipping.service'
import { ShipmentTrackingService } from '../services/shipment-tracking.service'

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

async function createTestShipment(db: D1Database): Promise<number> {
    const service = new ShippingService(db)
    const shipment = await service.create({
        orderId: 3,
        trackingNumber: 'JP-TRACK-001',
        carrier: 'YAMATO',
        distributorId: 2,
        role: 'distributor',
    })
    return shipment.id
}

describe('ShipmentTracking Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('addEvent() creates a tracking event', async () => {
        const shipmentId = await createTestShipment(env.DB)
        const trackingService = new ShipmentTrackingService(env.DB)
        const event = await trackingService.addEvent(shipmentId, 'IN_TRANSIT', 'Tokyo Hub', 'Package arrived at hub')
        expect(event.shipment_id).toBe(shipmentId)
        expect(event.status).toBe('IN_TRANSIT')
        expect(event.location).toBe('Tokyo Hub')
    })

    it('addEvent() rejects invalid status', async () => {
        const shipmentId = await createTestShipment(env.DB)
        const trackingService = new ShipmentTrackingService(env.DB)
        await expect(trackingService.addEvent(shipmentId, 'INVALID_STATUS'))
            .rejects.toThrow('Invalid event status')
    })

    it('getEvents() returns events in chronological order', async () => {
        const shipmentId = await createTestShipment(env.DB)
        const trackingService = new ShipmentTrackingService(env.DB)

        // The create already added a SHIPPED event, add more
        await trackingService.addEvent(shipmentId, 'PICKED_UP', 'Warehouse')
        await trackingService.addEvent(shipmentId, 'IN_TRANSIT', 'Tokyo Hub')

        const events = await trackingService.getEvents(shipmentId)
        expect(events.length).toBeGreaterThanOrEqual(2)
        // Verify chronological order
        for (let i = 1; i < events.length; i++) {
            expect(events[i].event_time >= events[i - 1].event_time).toBe(true)
        }
    })

    it('getTrackingUrl() returns URL for YAMATO', () => {
        const trackingService = new ShipmentTrackingService(env.DB)
        const url = trackingService.getTrackingUrl('YAMATO', '1234567890')
        expect(url).toContain('kuronekoyamato')
        expect(url).toContain('1234567890')
    })

    it('getTrackingUrl() returns null for OTHER', () => {
        const trackingService = new ShipmentTrackingService(env.DB)
        const url = trackingService.getTrackingUrl('OTHER', '1234567890')
        expect(url).toBeNull()
    })

    it('updateStatusWithEvent() updates shipment and adds event', async () => {
        const shipmentId = await createTestShipment(env.DB)
        const trackingService = new ShipmentTrackingService(env.DB)

        const result = await trackingService.updateStatusWithEvent(shipmentId, 'IN_TRANSIT', {
            location: 'Osaka',
            description: 'In transit to destination',
        })
        expect(result.shipment.status).toBe('IN_TRANSIT')
        expect(result.event.status).toBe('IN_TRANSIT')
    })

    it('batchAddEvents() processes multiple events', async () => {
        const shipmentId = await createTestShipment(env.DB)
        const trackingService = new ShipmentTrackingService(env.DB)

        const result = await trackingService.batchAddEvents([
            { shipment_id: shipmentId, status: 'IN_TRANSIT', location: 'Tokyo' },
            { shipment_id: shipmentId, status: 'OUT_FOR_DELIVERY', location: 'Customer area' },
        ])
        expect(result.success).toBe(2)
        expect(result.errors.length).toBe(0)
    })
})

describe('ShipmentTracking Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('GET /shipping/:id/events returns events', async () => {
        const shipmentId = await createTestShipment(env.DB)

        const res = await SELF.fetch(`http://localhost/api/v1/shipping/${shipmentId}/events`, {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(Array.isArray(data.events)).toBe(true)
    })

    it('POST /shipping/:id/events requires admin', async () => {
        const shipmentId = await createTestShipment(env.DB)

        const res = await SELF.fetch(`http://localhost/api/v1/shipping/${shipmentId}/events`, {
            method: 'POST',
            headers: { ...authHeaders(TOKEN_2), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'IN_TRANSIT', location: 'Tokyo' }),
        })
        expect(res.status).toBe(403)
    })

    it('GET /shipping/:id/timeline returns full timeline', async () => {
        const shipmentId = await createTestShipment(env.DB)

        const res = await SELF.fetch(`http://localhost/api/v1/shipping/${shipmentId}/timeline`, {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.shipment).toBeTruthy()
        expect(Array.isArray(data.events)).toBe(true)
        expect(data.tracking_url).toContain('kuronekoyamato')
    })
})
