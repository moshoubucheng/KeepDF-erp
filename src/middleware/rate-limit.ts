import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../db/types'

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 300 // 5 minutes

/**
 * Login Rate Limiter - KV 滑动窗口
 * 同一 IP 5分钟内最多 5 次登录尝试
 */
export const loginRateLimit = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    const key = `ratelimit:login:${ip}`

    const record = await c.env.KV.get(key)
    const attempts = record ? Number(record) : 0

    if (attempts >= MAX_ATTEMPTS) {
        return c.json({ error: 'Too many login attempts. Please try again later.' }, 429)
    }

    await c.env.KV.put(key, String(attempts + 1), { expirationTtl: WINDOW_SECONDS })

    await next()
})
