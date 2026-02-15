import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { ForecastingService } from '../services/forecasting.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const forecasting = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /forecasting/export - CSV export */
forecasting.get('/export', async (c) => {
    const service = new ForecastingService(c.env.DB)
    const { forecasts } = await service.getAll({ limit: 5000 })

    const csv = toCSV(forecasts as unknown as Record<string, unknown>[], [
        { key: 'sku', header: 'SKU' },
        { key: 'product_name', header: '商品名' },
        { key: 'current_stock', header: '現在庫' },
        { key: 'daily_velocity', header: '日販数' },
        { key: 'days_of_stock', header: '在庫日数' },
        { key: 'reorder_point', header: '発注点' },
        { key: 'safety_stock', header: '安全在庫' },
        { key: 'lead_time_days', header: 'リードタイム' },
        { key: 'calculated_at', header: '計算日時' },
    ])

    return csvResponse(csv, 'forecasts.csv')
})

/** GET /forecasting/reorder-suggestions - Reorder suggestions */
forecasting.get('/reorder-suggestions', async (c) => {
    const service = new ForecastingService(c.env.DB)
    const suggestions = await service.getReorderSuggestions()

    return c.json({ suggestions, count: suggestions.length })
})

/** GET /forecasting - All SKU forecasts */
forecasting.get('/', async (c) => {
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const service = new ForecastingService(c.env.DB)
    const result = await service.getAll({ limit, offset })

    return c.json({ forecasts: result.forecasts, total: result.total })
})

/** GET /forecasting/:sku - Single SKU detail */
forecasting.get('/:sku', async (c) => {
    const service = new ForecastingService(c.env.DB)
    const forecast = await service.getBySku(c.req.param('sku'))

    if (!forecast) return c.json({ error: 'Forecast not found for this SKU' }, 404)
    return c.json({ forecast })
})

/** POST /forecasting/calculate - Manual recalculation (admin only) */
forecasting.post('/calculate', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const service = new ForecastingService(c.env.DB)
    const result = await service.calculate()

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'CALCULATE_FORECAST',
        resourceType: 'forecast',
        details: `calculated=${result.calculated} SKUs`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, ...result })
})

export { forecasting }
