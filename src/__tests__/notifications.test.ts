import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { NotificationCenterService } from '../services/notification-center.service'

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

describe('NotificationCenter Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('create() inserts a notification', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({
            distributorId: 1,
            type: 'ORDER_SHIPPED',
            title: 'Test',
            message: 'Order shipped',
        })

        const { results } = await env.DB.prepare('SELECT * FROM notifications').all()
        expect(results.length).toBe(1)
        expect(results[0].type).toBe('ORDER_SHIPPED')
        expect(results[0].is_read).toBe(0)
    })

    it('list() returns notifications with counts', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T1', message: 'M1' })
        await service.create({ distributorId: 1, type: 'ORDER_DELIVERED', title: 'T2', message: 'M2' })
        await service.create({ distributorId: 2, type: 'LOW_STOCK', title: 'T3', message: 'M3' })

        const result = await service.list(1)
        expect(result.notifications.length).toBe(2)
        expect(result.total).toBe(2)
        expect(result.unreadCount).toBe(2)
    })

    it('getUnreadCount() returns correct count', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T', message: 'M' })
        await service.create({ distributorId: 1, type: 'ORDER_DELIVERED', title: 'T', message: 'M' })

        expect(await service.getUnreadCount(1)).toBe(2)

        // Mark one as read
        const { results } = await env.DB.prepare('SELECT id FROM notifications WHERE distributor_id = 1').all()
        await service.markRead(results[0].id as number, 1)

        expect(await service.getUnreadCount(1)).toBe(1)
    })

    it('markRead() marks only own notification', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T', message: 'M' })

        const { results } = await env.DB.prepare('SELECT id FROM notifications').all()
        const notifId = results[0].id as number

        // Try to mark as another user - should fail
        const updated = await service.markRead(notifId, 2)
        expect(updated).toBe(false)

        // Mark as correct user
        const ok = await service.markRead(notifId, 1)
        expect(ok).toBe(true)
    })

    it('markAllRead() marks all unread for distributor', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T1', message: 'M1' })
        await service.create({ distributorId: 1, type: 'ORDER_DELIVERED', title: 'T2', message: 'M2' })
        await service.create({ distributorId: 2, type: 'LOW_STOCK', title: 'T3', message: 'M3' })

        const count = await service.markAllRead(1)
        expect(count).toBe(2)

        // Dist 2 notification still unread
        expect(await service.getUnreadCount(2)).toBe(1)
    })

    it('updatePreferences() upserts preferences', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.updatePreferences(1, [
            { event_type: 'ORDER_SHIPPED', enabled: true, channel: 'IN_APP' },
            { event_type: 'LOW_STOCK', enabled: false },
        ])

        const prefs = await service.getPreferences(1)
        expect(prefs.length).toBe(2)

        // Update existing
        await service.updatePreferences(1, [
            { event_type: 'ORDER_SHIPPED', enabled: false },
        ])

        const updated = await service.getPreferences(1)
        const shipped = updated.find((p: any) => p.event_type === 'ORDER_SHIPPED')
        expect(shipped.enabled).toBe(0) // SQLite stores as 0/1
    })

    it('notifyOrderShipped() creates typed notification', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.notifyOrderShipped(1, 42, 'JP-123')

        const { results } = await env.DB.prepare('SELECT * FROM notifications WHERE distributor_id = 1').all()
        expect(results.length).toBe(1)
        expect(results[0].type).toBe('ORDER_SHIPPED')
        expect(results[0].related_resource_type).toBe('order')
        expect(results[0].related_resource_id).toBe('42')
    })
})

describe('Notifications Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('GET /notifications returns notifications for user', async () => {
        // Create some notifications
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T', message: 'M' })

        const res = await SELF.fetch('http://localhost/api/v1/notifications', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.notifications.length).toBe(1)
        expect(data.unreadCount).toBe(1)
    })

    it('GET /notifications/unread-count returns count', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T', message: 'M' })
        await service.create({ distributorId: 1, type: 'LOW_STOCK', title: 'T', message: 'M' })

        const res = await SELF.fetch('http://localhost/api/v1/notifications/unread-count', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.unreadCount).toBe(2)
    })

    it('PATCH /notifications/:id/read marks as read', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T', message: 'M' })
        const { results } = await env.DB.prepare('SELECT id FROM notifications WHERE distributor_id = 1').all()

        const res = await SELF.fetch(`http://localhost/api/v1/notifications/${results[0].id}/read`, {
            method: 'PATCH',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)

        // Verify unread count decreased
        const countRes = await SELF.fetch('http://localhost/api/v1/notifications/unread-count', {
            headers: authHeaders(TOKEN),
        })
        const data = await countRes.json() as any
        expect(data.unreadCount).toBe(0)
    })

    it('POST /notifications/mark-all-read marks all', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T1', message: 'M1' })
        await service.create({ distributorId: 1, type: 'ORDER_DELIVERED', title: 'T2', message: 'M2' })

        const res = await SELF.fetch('http://localhost/api/v1/notifications/mark-all-read', {
            method: 'POST',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.marked).toBe(2)
    })

    it('data isolation: dist2 cannot see dist1 notifications', async () => {
        const service = new NotificationCenterService(env.DB)
        await service.create({ distributorId: 1, type: 'ORDER_SHIPPED', title: 'T', message: 'M' })

        const res = await SELF.fetch('http://localhost/api/v1/notifications', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.notifications.length).toBe(0)
    })

    it('PUT /notifications/preferences updates preferences', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/notifications/preferences', {
            method: 'PUT',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                preferences: [
                    { event_type: 'ORDER_SHIPPED', enabled: true },
                    { event_type: 'LOW_STOCK', enabled: false },
                ],
            }),
        })
        expect(res.status).toBe(200)

        const getRes = await SELF.fetch('http://localhost/api/v1/notifications/preferences', {
            headers: authHeaders(TOKEN),
        })
        const data = await getRes.json() as any
        expect(data.preferences.length).toBe(2)
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/notifications')
        expect(res.status).toBe(401)
    })
})
