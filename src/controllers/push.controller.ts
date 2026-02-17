import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { PushService } from '../services/push.service'

export const push = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /vapid-key — Public endpoint (no auth required)
 * Returns the VAPID public key for browser push subscription.
 */
push.get('/vapid-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || '' })
})

/**
 * POST /subscribe — Register a push subscription
 */
push.post('/subscribe', async (c) => {
  const distributorId = c.get('distributorId')
  const body = await c.req.json<{
    endpoint: string
    keys: { p256dh: string; auth: string }
  }>()

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'Missing endpoint or keys' }, 400)
  }

  const service = new PushService(c.env.DB, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY)
  await service.subscribe({
    distributorId,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: c.req.header('User-Agent'),
  })

  return c.json({ success: true })
})

/**
 * POST /unsubscribe — Remove a push subscription
 */
push.post('/unsubscribe', async (c) => {
  const distributorId = c.get('distributorId')
  const body = await c.req.json<{ endpoint: string }>()

  if (!body.endpoint) {
    return c.json({ error: 'Missing endpoint' }, 400)
  }

  const service = new PushService(c.env.DB, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY)
  const deleted = await service.unsubscribe(distributorId, body.endpoint)

  return c.json({ success: true, deleted })
})

/**
 * POST /test — Send a test push notification to the current user
 */
push.post('/test', async (c) => {
  const distributorId = c.get('distributorId')
  const service = new PushService(c.env.DB, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY)

  const result = await service.sendToDistributor(distributorId, {
    title: 'KeepDF ERP',
    body: 'テスト通知です。Push notifications are working!',
    icon: '/icon-192.svg',
    url: '/notifications',
    tag: 'test-notification',
  })

  return c.json({ success: true, ...result })
})
