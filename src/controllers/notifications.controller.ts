import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { NotificationCenterService } from '../services/notification-center.service'

const notifications = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /notifications - List notifications */
notifications.get('/', async (c) => {
    const distributorId = c.get('distributorId')
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new NotificationCenterService(c.env.DB)
    const result = await service.list(distributorId, limit, offset)

    return c.json(result)
})

/** GET /notifications/unread-count - Unread count */
notifications.get('/unread-count', async (c) => {
    const distributorId = c.get('distributorId')
    const service = new NotificationCenterService(c.env.DB)
    const count = await service.getUnreadCount(distributorId)

    return c.json({ unreadCount: count })
})

/** PATCH /notifications/:id/read - Mark as read */
notifications.patch('/:id/read', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    const service = new NotificationCenterService(c.env.DB)
    const updated = await service.markRead(id, distributorId)

    if (!updated) return c.json({ error: 'Notification not found' }, 404)
    return c.json({ success: true })
})

/** POST /notifications/mark-all-read - Mark all as read */
notifications.post('/mark-all-read', async (c) => {
    const distributorId = c.get('distributorId')
    const service = new NotificationCenterService(c.env.DB)
    const count = await service.markAllRead(distributorId)

    return c.json({ success: true, marked: count })
})

/** GET /notifications/preferences - Get preferences */
notifications.get('/preferences', async (c) => {
    const distributorId = c.get('distributorId')
    const service = new NotificationCenterService(c.env.DB)
    const preferences = await service.getPreferences(distributorId)

    return c.json({ preferences })
})

/** PUT /notifications/preferences - Update preferences */
notifications.put('/preferences', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ preferences: { event_type: string; enabled: boolean; channel?: string; webhook_url?: string }[] }>()

    if (!body.preferences || !Array.isArray(body.preferences)) {
        return c.json({ error: 'preferences array is required' }, 400)
    }

    const service = new NotificationCenterService(c.env.DB)
    await service.updatePreferences(distributorId, body.preferences)

    return c.json({ success: true })
})

export { notifications }
