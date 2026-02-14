import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables } from '../db/types'

/**
 * Admin-only middleware
 * Requires role === 'admin', otherwise returns 403
 */
export const adminOnly = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    if (c.get('role') !== 'admin') {
        return c.json({ error: 'Forbidden: admin access required' }, 403)
    }
    return next()
})
