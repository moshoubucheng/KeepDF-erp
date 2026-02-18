import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables } from '../db/types'

/**
 * Auth Middleware - 简单 Token 验证
 * 从 Header 中提取 Bearer Token，验证是否属于有效分销商
 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const path = c.req.path

    // 跳过无需认证的路径（精确匹配或前缀匹配）
    const exactPaths = ['/', '/health']
    const prefixPaths = ['/api/webhooks', '/api/v1/orders/webhook', '/api/v1/auth/login', '/api/v1/auth/verify-2fa', '/api/v1/push/vapid-key']
    if (exactPaths.includes(path) || prefixPaths.some((p) => path.startsWith(p))) {
        return next()
    }

    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7)

    // 先查 KV 缓存（格式: "id:role" 或旧格式 "id"）
    const cached = await c.env.KV.get(`session:${token}`)
    if (cached) {
        const parts = cached.split(':')
        c.set('distributorId', Number(parts[0]))
        c.set('role', (parts[1] as 'admin' | 'distributor') || 'distributor')
        // Refresh TTL on each request (sliding session), skip logout to avoid race
        if (!path.endsWith('/auth/logout')) {
            c.executionCtx.waitUntil(
                c.env.KV.put(`session:${token}`, cached, { expirationTtl: 3600 })
            )
        }
        return next()
    }

    // 查 D1
    const distributor = await c.env.DB.prepare(
        'SELECT id, role FROM distributors WHERE token = ?'
    ).bind(token).first<{ id: number; role: string }>()

    if (!distributor) {
        return c.json({ error: 'Invalid token' }, 401)
    }

    const role = (distributor.role as 'admin' | 'distributor') || 'distributor'

    // 写入 KV 缓存（1小时过期，格式: "id:role"）
    await c.env.KV.put(`session:${token}`, `${distributor.id}:${role}`, { expirationTtl: 3600 })
    c.set('distributorId', distributor.id)
    c.set('role', role)

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
