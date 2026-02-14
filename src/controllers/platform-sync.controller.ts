import { Hono } from 'hono'
import type { Bindings, Variables, PlatformSyncLog } from '../db/types'
import { adminOnly } from '../middleware/admin'
import { PlatformSyncService } from '../services/platform-sync.service'

const VALID_PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const

const platformSync = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All routes require admin
platformSync.use('/*', adminOnly)

/** POST /platform-sync/:platform - 触发手动同步 */
platformSync.post('/:platform', async (c) => {
    const platform = c.req.param('platform').toUpperCase()

    if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
        return c.json({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` }, 400)
    }

    const service = new PlatformSyncService(c.env.DB, c.env.ORDER_QUEUE)
    const result = await service.syncPlatform(platform, 'MANUAL')

    return c.json({
        success: true,
        platform,
        ...result,
    })
})

/** GET /platform-sync/logs - 查看同步历史 */
platformSync.get('/logs', async (c) => {
    const platform = c.req.query('platform')?.toUpperCase()
    const rawLimit = Number(c.req.query('limit') || 50)
    const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200))

    let sql = 'SELECT * FROM platform_sync_logs'
    const params: (string | number)[] = []

    if (platform && VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
        sql += ' WHERE platform = ?'
        params.push(platform)
    }

    sql += ' ORDER BY started_at DESC LIMIT ?'
    params.push(limit)

    const { results } = await c.env.DB.prepare(sql).bind(...params).all<PlatformSyncLog>()

    return c.json({ logs: results, count: results.length })
})

export { platformSync }
