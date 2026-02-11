import { Hono } from 'hono'
import type { Bindings, Variables, Distributor } from '../db/types'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** POST /auth/login - 分销商登录 */
auth.post('/login', async (c) => {
    const body = await c.req.json<{ token: string }>()
    if (!body.token) {
        return c.json({ error: 'Token is required' }, 400)
    }

    const distributor = await c.env.DB.prepare(
        'SELECT id, name, balance, frozen_balance, tax_reg_number FROM distributors WHERE token = ?'
    ).bind(body.token).first<Distributor>()

    if (!distributor) {
        return c.json({ error: 'Invalid token' }, 401)
    }

    // 写入 KV session（1小时过期）
    await c.env.KV.put(`session:${body.token}`, String(distributor.id), { expirationTtl: 3600 })

    return c.json({
        success: true,
        distributor: {
            id: distributor.id,
            name: distributor.name,
            balance: distributor.balance,
            frozen_balance: distributor.frozen_balance,
            tax_reg_number: distributor.tax_reg_number,
        },
        expiresIn: 3600,
    })
})

/** POST /auth/logout - 清除 session */
auth.post('/logout', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        await c.env.KV.delete(`session:${token}`)
    }
    return c.json({ success: true, message: 'Logged out successfully' })
})

/** GET /auth/me - 获取当前用户信息 */
auth.get('/me', async (c) => {
    const distributorId = c.get('distributorId')
    const distributor = await c.env.DB.prepare(
        'SELECT id, name, balance, frozen_balance, tax_reg_number, created_at FROM distributors WHERE id = ?'
    ).bind(distributorId).first<Distributor>()

    if (!distributor) {
        return c.json({ error: 'Distributor not found' }, 404)
    }

    return c.json({
        distributor: {
            id: distributor.id,
            name: distributor.name,
            balance: distributor.balance,
            frozen_balance: distributor.frozen_balance,
            tax_reg_number: distributor.tax_reg_number,
            created_at: distributor.created_at,
        },
    })
})

export { auth }
