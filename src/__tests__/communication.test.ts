import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { CommunicationService } from '../services/communication.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'inventory_forecasts', 'message_triggers', 'customer_messages', 'message_templates',
    'price_history', 'price_rules', 'purchase_order_items', 'purchase_orders', 'suppliers',
    'return_items', 'returns',
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
    // Add a test customer
    await db.prepare(
        "INSERT INTO customers (name, email, distributor_id) VALUES ('Communication Test Customer', 'comm@test.com', 1)"
    ).run()
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Communication Service', () => {
    beforeEach(async () => { await setupDB(env.DB) })

    it('creates a message template', async () => {
        const service = new CommunicationService(env.DB)
        const template = await service.createTemplate({
            name: 'Order Confirmation',
            type: 'ORDER_CONFIRMATION',
            subject: 'Order #{{order_id}} Confirmed',
            body: 'Dear {{customer_name}}, your order has been confirmed.',
            distributorId: 1,
        })

        expect(template.name).toBe('Order Confirmation')
        expect(template.type).toBe('ORDER_CONFIRMATION')
        expect(template.channel).toBe('EMAIL')
    })

    it('validates template type', async () => {
        const service = new CommunicationService(env.DB)
        await expect(service.createTemplate({
            name: 'Invalid',
            type: 'INVALID_TYPE',
            body: 'test',
            distributorId: 1,
        })).rejects.toThrow('Invalid template type')
    })

    it('updates a template', async () => {
        const service = new CommunicationService(env.DB)
        const template = await service.createTemplate({
            name: 'Original',
            type: 'CUSTOM',
            body: 'Original body',
            distributorId: 1,
        })

        const updated = await service.updateTemplate(
            template.id, { body: 'Updated body' }, 1, 'admin'
        )
        expect(updated!.body).toBe('Updated body')
    })

    it('deletes a template', async () => {
        const service = new CommunicationService(env.DB)
        const template = await service.createTemplate({
            name: 'To Delete',
            type: 'CUSTOM',
            body: 'delete me',
            distributorId: 1,
        })

        const deleted = await service.deleteTemplate(template.id, 1, 'admin')
        expect(deleted).toBe(true)
    })

    it('sends a message', async () => {
        const service = new CommunicationService(env.DB)
        const message = await service.sendMessage({
            customerId: 1,
            type: 'CUSTOM',
            content: 'Hello from test!',
            distributorId: 1,
        })

        expect(message.content).toBe('Hello from test!')
        expect(message.status).toBe('SENT')
        expect(message.customer_id).toBe(1)
    })

    it('rejects message to non-existent customer', async () => {
        const service = new CommunicationService(env.DB)
        await expect(service.sendMessage({
            customerId: 999,
            type: 'CUSTOM',
            content: 'Should fail',
            distributorId: 1,
        })).rejects.toThrow('Customer not found')
    })

    it('lists messages with data isolation', async () => {
        const service = new CommunicationService(env.DB)
        await service.sendMessage({
            customerId: 1, type: 'CUSTOM', content: 'Test msg', distributorId: 1,
        })

        const admin = await service.listMessages(1, 'admin')
        expect(admin.messages.length).toBe(1)

        const dist2 = await service.listMessages(2, 'distributor')
        expect(dist2.messages.length).toBe(0)
    })

    it('creates and deletes triggers', async () => {
        const service = new CommunicationService(env.DB)
        const template = await service.createTemplate({
            name: 'Trigger Template',
            type: 'SHIPPING_NOTIFICATION',
            body: 'Your order {{order_id}} has shipped!',
            distributorId: 1,
        })

        const trigger = await service.createTrigger({
            eventType: 'ORDER_SHIPPED',
            templateId: template.id,
            distributorId: 1,
        })

        expect(trigger.event_type).toBe('ORDER_SHIPPED')

        const triggers = await service.listTriggers(1, 'admin')
        expect(triggers.length).toBe(1)

        const deleted = await service.deleteTrigger(trigger.id, 1, 'admin')
        expect(deleted).toBe(true)
    })

    it('validates trigger event type', async () => {
        const service = new CommunicationService(env.DB)
        const template = await service.createTemplate({
            name: 'T', type: 'CUSTOM', body: 'b', distributorId: 1,
        })

        await expect(service.createTrigger({
            eventType: 'INVALID_EVENT',
            templateId: template.id,
            distributorId: 1,
        })).rejects.toThrow('Invalid event type')
    })

    it('triggerOnEvent sends auto-messages', async () => {
        const service = new CommunicationService(env.DB)

        // Setup: customer on order 1
        await env.DB.prepare("UPDATE orders SET customer_id = 1, status = 'DELIVERED' WHERE id = 1").run()

        // Create template and trigger
        const template = await service.createTemplate({
            name: 'Delivery Notice',
            type: 'DELIVERY_CONFIRMATION',
            body: 'Order #{{order_id}} delivered!',
            distributorId: 1,
        })

        await service.createTrigger({
            eventType: 'ORDER_DELIVERED',
            templateId: template.id,
            distributorId: 1,
        })

        // Fire event
        await service.triggerOnEvent('ORDER_DELIVERED', 1, 1)

        // Check message was sent
        const messages = await service.getCustomerMessages(1, 1, 'admin')
        expect(messages.length).toBe(1)
        expect(messages[0].content).toContain('Order #1 delivered!')
    })
})

describe('Communications Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('POST /communications/templates creates a template', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'API Template',
                type: 'CUSTOM',
                body: 'Hello {{customer_name}}',
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.template.name).toBe('API Template')
    })

    it('GET /communications/templates returns list', async () => {
        await SELF.fetch('http://localhost/api/v1/communications/templates', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Listed', type: 'CUSTOM', body: 'test' }),
        })

        const res = await SELF.fetch('http://localhost/api/v1/communications/templates', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.templates.length).toBeGreaterThanOrEqual(1)
    })

    it('POST /communications/send sends a message', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/send', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: 1,
                type: 'CUSTOM',
                content: 'Hello via API!',
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.message.content).toBe('Hello via API!')
    })

    it('POST /communications/send validates required fields', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/send', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: 1 }),
        })
        expect(res.status).toBe(400)
    })

    it('GET /communications/messages returns message history', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/communications/messages', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
    })
})
