import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables } from '../db/types'

/**
 * Auth Middleware - 简单 Token 验证
 * 从 Header 中提取 Bearer Token，验证是否属于有效分销商
 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const path = c.req.path

    // 跳过无需认证的路径
    const publicPaths = ['/', '/health', '/api/webhooks']
    if (publicPaths.some((p) => path.startsWith(p))) {
        return next()
    }

    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7)

    // 先查 KV 缓存
    const cached = await c.env.KV.get(`session:${token}`)
    if (cached) {
        c.set('distributorId', Number(cached))
        return next()
    }

    // 查 D1
    const distributor = await c.env.DB.prepare(
        'SELECT id FROM distributors WHERE token = ?'
    ).bind(token).first<{ id: number }>()

    if (!distributor) {
        return c.json({ error: 'Invalid token' }, 403)
    }

    // 写入 KV 缓存（1小时过期）
    await c.env.KV.put(`session:${token}`, String(distributor.id), { expirationTtl: 3600 })
    c.set('distributorId', distributor.id)

    return next()
})

/**
 * Logger Middleware - API 请求日志
 * 记录所有 API 请求到 D1 api_logs 表
 */
export const loggerMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const start = Date.now()

    await next()

    const elapsed = Date.now() - start
    const path = c.req.path

    // 仅记录 /api 路径
    if (path.startsWith('/api')) {
        try {
            await c.env.DB.prepare(
                'INSERT INTO api_logs (platform, endpoint, status_code, response_time_ms) VALUES (?, ?, ?, ?)'
            ).bind('INTERNAL', path, c.res.status, elapsed).run()
        } catch (e) {
            console.error('Failed to log API request:', e)
        }
    }
})
