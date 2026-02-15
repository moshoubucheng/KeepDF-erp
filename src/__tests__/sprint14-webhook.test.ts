import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { WebhookService } from '../services/webhook.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'

const TABLE_NAMES = [
    'dashboard_layouts', 'webhook_logs', 'webhook_endpoints', 'audit_snapshots',
    'approval_requests', 'approval_workflows', 'promotions', 'customer_segments',
    'stocktake_items', 'stocktakes', 'shipping_fees', 'shipping_fee_templates',
    'coupon_usage', 'coupons', 'shipment_events', 'exchange_rates',
    'automation_logs', 'automation_rules',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
]

async function setupDB(db: D1Database) {
    for (const table of TABLE_NAMES) { await db.prepare(`DROP TABLE IF EXISTS ${table}`).run() }
    for (const stmt of schemaSQL.split(';')) { const t = stmt.trim(); if (t) await db.prepare(t).run() }
    for (const stmt of seedSQL.split(';')) { const t = stmt.trim(); if (t) await db.prepare(t).run() }
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Webhook Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates an endpoint', async () => {
        const service = new WebhookService(env.DB)
        const ep = await service.createEndpoint({
            name: 'My Webhook', url: 'https://example.com/hook',
            events: ['ORDER_CREATED', 'ORDER_SHIPPED'],
            secret: 'test-secret',
        }, 1)
        expect(ep.name).toBe('My Webhook')
        expect(ep.url).toBe('https://example.com/hook')
        expect(JSON.parse(ep.events)).toContain('ORDER_CREATED')
    })

    it('lists endpoints', async () => {
        const service = new WebhookService(env.DB)
        await service.createEndpoint({ name: 'E1', url: 'https://a.com', events: ['ORDER_CREATED'] }, 1)
        await service.createEndpoint({ name: 'E2', url: 'https://b.com', events: ['ORDER_SHIPPED'] }, 1)
        const eps = await service.listEndpoints(1, 'admin')
        expect(eps.length).toBe(2)
    })

    it('data isolation for distributors', async () => {
        const service = new WebhookService(env.DB)
        await service.createEndpoint({ name: 'E1', url: 'https://a.com', events: ['ORDER_CREATED'] }, 1)
        const eps = await service.listEndpoints(2, 'distributor')
        expect(eps.length).toBe(0)
    })

    it('updates an endpoint', async () => {
        const service = new WebhookService(env.DB)
        const ep = await service.createEndpoint({ name: 'E', url: 'https://a.com', events: ['ORDER_CREATED'] }, 1)
        const updated = await service.updateEndpoint(ep.id, { name: 'Updated' }, 1, 'admin')
        expect(updated.name).toBe('Updated')
    })

    it('deletes an endpoint', async () => {
        const service = new WebhookService(env.DB)
        const ep = await service.createEndpoint({ name: 'E', url: 'https://a.com', events: ['ORDER_CREATED'] }, 1)
        const deleted = await service.deleteEndpoint(ep.id, 1, 'admin')
        expect(deleted).toBe(true)
        const eps = await service.listEndpoints(1, 'admin')
        expect(eps.length).toBe(0)
    })

    it('rejects invalid events', async () => {
        const service = new WebhookService(env.DB)
        await expect(service.createEndpoint({
            name: 'E', url: 'https://a.com', events: ['INVALID_EVENT'],
        }, 1)).rejects.toThrow('Invalid events')
    })

    it('rejects missing name or url', async () => {
        const service = new WebhookService(env.DB)
        await expect(service.createEndpoint({
            name: '', url: 'https://a.com', events: ['ORDER_CREATED'],
        }, 1)).rejects.toThrow('name and url are required')
    })

    it('rejects empty events array', async () => {
        const service = new WebhookService(env.DB)
        await expect(service.createEndpoint({
            name: 'E', url: 'https://a.com', events: [],
        }, 1)).rejects.toThrow('At least one event')
    })

    it('triggerEvent only fires matching endpoints', async () => {
        const service = new WebhookService(env.DB)
        await service.createEndpoint({
            name: 'Order Hook', url: 'https://httpbin.org/post',
            events: ['ORDER_CREATED'], secret: 'sec',
        }, 1)
        await service.createEndpoint({
            name: 'Return Hook', url: 'https://httpbin.org/post',
            events: ['RETURN_CREATED'],
        }, 1)
        // triggerEvent with ORDER_SHIPPED should match neither since neither has ORDER_SHIPPED
        const result = await service.triggerEvent('ORDER_SHIPPED', { orderId: 1 }, 1)
        expect(result.triggered).toBe(0)
    })

    it('lists webhook logs', async () => {
        const service = new WebhookService(env.DB)
        const ep = await service.createEndpoint({
            name: 'E', url: 'https://httpbin.org/post',
            events: ['ORDER_CREATED'],
        }, 1)
        // Manually insert a log entry
        await env.DB.prepare(
            `INSERT INTO webhook_logs (endpoint_id, event, payload, status_code, success) VALUES (?, ?, ?, ?, ?)`
        ).bind(ep.id, 'ORDER_CREATED', '{}', 200, 1).run()

        const { logs, total } = await service.listLogs(ep.id)
        expect(total).toBe(1)
        expect(logs[0].event).toBe('ORDER_CREATED')
    })
})

describe('Webhook API', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('POST /webhooks creates endpoint', async () => {
        const res = await SELF.fetch('https://erp.keepdf.com/api/v1/webhooks', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Hook', url: 'https://example.com/hook',
                events: ['ORDER_CREATED'],
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.name).toBe('Test Hook')
    })
})
