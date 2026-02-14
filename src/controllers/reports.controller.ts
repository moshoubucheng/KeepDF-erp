import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ReportsService, VALID_DIMENSIONS, VALID_METRICS } from '../services/reports.service'
import { toCSV, csvResponse, type CsvColumn } from '../utils/csv'

const VALID_PERIODS = ['7d', '30d', '90d', 'all'] as const
const VALID_PROFIT_GROUP = ['product', 'platform'] as const
const VALID_TREND_GROUP = ['day', 'week'] as const

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /reports/summary */
reports.get('/summary', async (c) => {
    const period = c.req.query('period') || '30d'
    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
        return c.json({ error: 'Invalid period. Must be one of: 7d, 30d, 90d, all' }, 400)
    }

    const service = new ReportsService(c.env.DB)
    const result = await service.getSummaryKpi({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        period,
    })

    return c.json({ period, ...result })
})

/** GET /reports/profit-analysis */
reports.get('/profit-analysis', async (c) => {
    const period = c.req.query('period') || '30d'
    const groupBy = c.req.query('group_by') || 'product'

    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
        return c.json({ error: 'Invalid period. Must be one of: 7d, 30d, 90d, all' }, 400)
    }
    if (!(VALID_PROFIT_GROUP as readonly string[]).includes(groupBy)) {
        return c.json({ error: 'Invalid group_by. Must be one of: product, platform' }, 400)
    }

    const service = new ReportsService(c.env.DB)
    const data = await service.getProfitAnalysis({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        period,
        groupBy,
    })

    return c.json({ period, groupBy, data })
})

/** GET /reports/platform-comparison */
reports.get('/platform-comparison', async (c) => {
    const period = c.req.query('period') || '30d'
    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
        return c.json({ error: 'Invalid period. Must be one of: 7d, 30d, 90d, all' }, 400)
    }

    const service = new ReportsService(c.env.DB)
    const data = await service.getPlatformComparison({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        period,
    })

    return c.json({ period, platforms: data })
})

/** GET /reports/trend-comparison */
reports.get('/trend-comparison', async (c) => {
    const period = c.req.query('period') || '30d'
    const groupBy = c.req.query('group_by') || 'day'

    if (period === 'all' || !(VALID_PERIODS as readonly string[]).includes(period)) {
        return c.json({ error: 'Invalid period. Must be one of: 7d, 30d, 90d' }, 400)
    }
    if (!(VALID_TREND_GROUP as readonly string[]).includes(groupBy)) {
        return c.json({ error: 'Invalid group_by. Must be one of: day, week' }, 400)
    }

    const service = new ReportsService(c.env.DB)
    const result = await service.getTrendComparison({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        period,
        groupBy,
    })

    return c.json({ period, groupBy, ...result })
})

/** GET /reports/custom */
reports.get('/custom', async (c) => {
    const validation = validateCustomParams(c)
    if ('error' in validation) {
        return c.json({ error: validation.error }, 400)
    }

    const service = new ReportsService(c.env.DB)
    const data = await service.buildCustomReport({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        ...validation,
    })

    return c.json({ data, dimensions: validation.dimensions, metrics: validation.metrics })
})

/** GET /reports/custom/export */
reports.get('/custom/export', async (c) => {
    const validation = validateCustomParams(c)
    if ('error' in validation) {
        return c.json({ error: validation.error }, 400)
    }

    const service = new ReportsService(c.env.DB)
    const data = await service.buildCustomReport({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        ...validation,
    })

    const columns: CsvColumn[] = [
        ...validation.dimensions.map(d => ({ key: d, header: d })),
        ...validation.metrics.map(m => ({ key: m, header: m })),
    ]

    const csv = toCSV(data as Record<string, unknown>[], columns)
    return csvResponse(csv, `report_${validation.startDate}_${validation.endDate}.csv`)
})

function validateCustomParams(c: { req: { query: (k: string) => string | undefined } }) {
    const startDate = c.req.query('start_date')
    const endDate = c.req.query('end_date')
    const dimensionsRaw = c.req.query('dimensions')
    const metricsRaw = c.req.query('metrics')

    if (!startDate || !endDate) {
        return { error: 'start_date and end_date are required' }
    }

    if (!dimensionsRaw || !metricsRaw) {
        return { error: 'dimensions and metrics are required' }
    }

    const dimensions = dimensionsRaw.split(',').filter(Boolean)
    const metrics = metricsRaw.split(',').filter(Boolean)

    if (dimensions.length === 0) {
        return { error: 'At least one dimension is required' }
    }
    if (metrics.length === 0) {
        return { error: 'At least one metric is required' }
    }

    for (const d of dimensions) {
        if (!(VALID_DIMENSIONS as readonly string[]).includes(d)) {
            return { error: `Invalid dimension: ${d}. Must be one of: ${VALID_DIMENSIONS.join(', ')}` }
        }
    }
    for (const m of metrics) {
        if (!(VALID_METRICS as readonly string[]).includes(m)) {
            return { error: `Invalid metric: ${m}. Must be one of: ${VALID_METRICS.join(', ')}` }
        }
    }

    return { startDate, endDate, dimensions, metrics }
}

export { reports }
