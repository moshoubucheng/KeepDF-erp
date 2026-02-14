import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../db/types'

/**
 * Security Headers Middleware
 * 设置常见安全响应头，防止常见 Web 攻击
 */
export const securityHeaders = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    await next()

    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'")
})
