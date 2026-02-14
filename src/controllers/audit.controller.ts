import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { adminOnly } from '../middleware/admin'
import { AuditService } from '../services/audit.service'
import { csvResponse } from '../utils/csv'

const auditLogs = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All routes require admin
auditLogs.use('/*', adminOnly)

/** GET /audit-logs/export - CSV export with filters */
auditLogs.get('/export', async (c) => {
    const filters = parseFilters(c)
    const service = new AuditService(c.env.DB)
    const csv = await service.exportCSV(filters)

    return csvResponse(csv, 'audit-logs.csv')
})

/** GET /audit-logs - Query with filters and pagination */
auditLogs.get('/', async (c) => {
    const filters = parseFilters(c)
    const service = new AuditService(c.env.DB)
    const { logs, total } = await service.query(filters)

    return c.json({
        logs,
        total,
        count: logs.length,
        hasMore: (filters.offset || 0) + logs.length < total,
    })
})

function parseFilters(c: any) {
    const rawLimit = Number(c.req.query('limit') || 50)
    const rawOffset = Number(c.req.query('offset') || 0)

    return {
        distributorId: c.req.query('distributor_id') ? Number(c.req.query('distributor_id')) : undefined,
        action: c.req.query('action') || undefined,
        resourceType: c.req.query('resource_type') || undefined,
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
        limit: Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200)),
        offset: Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset),
    }
}

export { auditLogs }
