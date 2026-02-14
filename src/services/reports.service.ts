import type { ReportParams, CustomReportParams } from '../db/types'

const PERIOD_DAYS: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
}

export const VALID_DIMENSIONS = ['platform', 'sku', 'status', 'date'] as const
export const VALID_METRICS = ['orders', 'revenue', 'cost', 'profit', 'commission', 'avg_value'] as const

const DIMENSION_SQL: Record<string, string> = {
    platform: 'o.platform',
    sku: 'oi.sku',
    status: 'o.status',
    date: 'DATE(o.created_at)',
}

const METRIC_SQL: Record<string, string> = {
    orders: 'COUNT(DISTINCT o.id)',
    revenue: 'COALESCE(SUM(oi.qty * oi.unit_price), 0)',
    cost: 'COALESCE(SUM(oi.qty * p.cost_price), 0)',
    profit: '(COALESCE(SUM(oi.qty * oi.unit_price), 0) - COALESCE(SUM(oi.qty * p.cost_price), 0))',
    commission: 'COALESCE(SUM(cs.commission_amount), 0)',
    avg_value: 'CASE WHEN COUNT(DISTINCT o.id) > 0 THEN COALESCE(SUM(oi.qty * oi.unit_price), 0) / COUNT(DISTINCT o.id) ELSE 0 END',
}

export class ReportsService {
    constructor(private db: D1Database) {}

    private buildFilters(params: ReportParams): { conditions: string[]; bindings: unknown[] } {
        const conditions: string[] = []
        const bindings: unknown[] = []

        if (params.role !== 'admin') {
            conditions.push('o.distributor_id = ?')
            bindings.push(params.distributorId)
        }

        if (params.period !== 'all') {
            const days = PERIOD_DAYS[params.period]
            if (days) {
                conditions.push("o.created_at >= datetime('now', '-' || ? || ' days')")
                bindings.push(days)
            }
        }

        return { conditions, bindings }
    }

    private buildWhere(conditions: string[]): string {
        return conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    }

    async getSummaryKpi(params: ReportParams) {
        const { conditions, bindings } = this.buildFilters(params)
        const where = this.buildWhere(conditions)

        // Query 1: order count + revenue (from total_amount)
        const kpi = await this.db.prepare(`
            SELECT
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM orders o
            ${where}
        `).bind(...bindings).first<{ order_count: number; revenue: number }>()

        // Query 2: cost from items
        const costResult = await this.db.prepare(`
            SELECT COALESCE(SUM(oi.qty * p.cost_price), 0) as total_cost
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN products p ON p.sku = oi.sku
            ${where}
        `).bind(...bindings).first<{ total_cost: number }>()

        // Query 3: commission (settled only)
        const commConditions = [...conditions]
        const commBindings = [...bindings]
        commConditions.push("cs.status = 'SETTLED'")
        const commWhere = this.buildWhere(commConditions)

        const commResult = await this.db.prepare(`
            SELECT COALESCE(SUM(cs.commission_amount), 0) as total_commission
            FROM commission_settlements cs
            JOIN orders o ON o.id = cs.order_id
            ${commWhere}
        `).bind(...commBindings).first<{ total_commission: number }>()

        // Query 4: top product by item revenue
        const topProduct = await this.db.prepare(`
            SELECT oi.sku, SUM(oi.qty * oi.unit_price) as product_revenue
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            ${where}
            GROUP BY oi.sku
            ORDER BY product_revenue DESC
            LIMIT 1
        `).bind(...bindings).first<{ sku: string; product_revenue: number }>()

        const revenue = kpi?.revenue || 0
        const cost = costResult?.total_cost || 0
        const orderCount = kpi?.order_count || 0

        return {
            revenue: Math.floor(revenue),
            cost: Math.floor(cost),
            profit: Math.floor(revenue - cost),
            commission: Math.floor(commResult?.total_commission || 0),
            orderCount,
            avgValue: orderCount > 0 ? Math.floor(revenue / orderCount) : 0,
            topProduct: topProduct?.sku || null,
        }
    }

    async getProfitAnalysis(params: ReportParams & { groupBy: string }) {
        const { conditions, bindings } = this.buildFilters(params)
        const where = this.buildWhere(conditions)

        const groupCol = params.groupBy === 'platform' ? 'o.platform' : 'oi.sku'
        const groupAlias = params.groupBy === 'platform' ? 'group_key' : 'group_key'

        const { results } = await this.db.prepare(`
            SELECT
                ${groupCol} as ${groupAlias},
                COALESCE(SUM(oi.qty * oi.unit_price), 0) as revenue,
                COALESCE(SUM(oi.qty * p.cost_price), 0) as cost,
                (COALESCE(SUM(oi.qty * oi.unit_price), 0) - COALESCE(SUM(oi.qty * p.cost_price), 0)) as profit,
                COUNT(DISTINCT o.id) as order_count
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN products p ON p.sku = oi.sku
            ${where}
            GROUP BY ${groupCol}
            ORDER BY revenue DESC
        `).bind(...bindings).all<{
            group_key: string
            revenue: number
            cost: number
            profit: number
            order_count: number
        }>()

        return results.map(r => ({
            [params.groupBy === 'platform' ? 'platform' : 'sku']: r.group_key,
            revenue: Math.floor(r.revenue),
            cost: Math.floor(r.cost),
            profit: Math.floor(r.profit),
            margin: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 10000) / 100 : 0,
            orderCount: r.order_count,
        }))
    }

    async getPlatformComparison(params: ReportParams) {
        const { conditions, bindings } = this.buildFilters(params)
        const where = this.buildWhere(conditions)

        const { results } = await this.db.prepare(`
            SELECT
                o.platform,
                COUNT(*) as order_count,
                COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) as delivered_count,
                COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) as cancelled_count,
                COALESCE(SUM(o.total_amount), 0) as revenue,
                CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(o.total_amount), 0) / COUNT(*) ELSE 0 END as avg_value
            FROM orders o
            ${where}
            GROUP BY o.platform
            ORDER BY revenue DESC
        `).bind(...bindings).all<{
            platform: string
            order_count: number
            delivered_count: number
            cancelled_count: number
            revenue: number
            avg_value: number
        }>()

        // Get commission per platform
        const commConditions = [...conditions]
        const commBindings = [...bindings]
        const commWhere = this.buildWhere(commConditions)

        const { results: commResults } = await this.db.prepare(`
            SELECT
                cs.platform,
                COALESCE(SUM(cs.commission_amount), 0) as commission
            FROM commission_settlements cs
            JOIN orders o ON o.id = cs.order_id
            ${commWhere}
            GROUP BY cs.platform
        `).bind(...commBindings).all<{ platform: string; commission: number }>()

        const commMap = new Map(commResults.map(c => [c.platform, c.commission]))

        return results.map(r => ({
            platform: r.platform,
            orderCount: r.order_count,
            deliveredCount: r.delivered_count,
            cancelledCount: r.cancelled_count,
            cancelRate: r.order_count > 0
                ? Math.round((r.cancelled_count / r.order_count) * 10000) / 100
                : 0,
            revenue: Math.floor(r.revenue),
            avgValue: Math.floor(r.avg_value),
            commission: Math.floor(commMap.get(r.platform) || 0),
        }))
    }

    async getTrendComparison(params: ReportParams & { groupBy: string }) {
        const days = PERIOD_DAYS[params.period]
        if (!days) throw new Error('Invalid period for trend')

        const dateExpr = params.groupBy === 'week'
            ? "strftime('%Y-W%W', o.created_at)"
            : 'DATE(o.created_at)'

        const distFilter = params.role !== 'admin'
            ? 'AND o.distributor_id = ?'
            : ''
        const distBindings = params.role !== 'admin' ? [params.distributorId] : []

        // Current period
        const { results: current } = await this.db.prepare(`
            SELECT
                ${dateExpr} as date,
                COUNT(*) as order_count,
                COALESCE(SUM(o.total_amount), 0) as revenue
            FROM orders o
            WHERE o.created_at >= datetime('now', '-' || ? || ' days')
                ${distFilter}
            GROUP BY ${dateExpr}
            ORDER BY date ASC
        `).bind(days, ...distBindings).all<{ date: string; order_count: number; revenue: number }>()

        // Previous period
        const { results: previous } = await this.db.prepare(`
            SELECT
                ${dateExpr} as date,
                COUNT(*) as order_count,
                COALESCE(SUM(o.total_amount), 0) as revenue
            FROM orders o
            WHERE o.created_at >= datetime('now', '-' || ? || ' days')
                AND o.created_at < datetime('now', '-' || ? || ' days')
                ${distFilter}
            GROUP BY ${dateExpr}
            ORDER BY date ASC
        `).bind(days * 2, days, ...distBindings).all<{ date: string; order_count: number; revenue: number }>()

        const currentTotal = current.reduce((s, r) => s + r.revenue, 0)
        const previousTotal = previous.reduce((s, r) => s + r.revenue, 0)
        const currentOrders = current.reduce((s, r) => s + r.order_count, 0)
        const previousOrders = previous.reduce((s, r) => s + r.order_count, 0)

        return {
            current: current.map(r => ({
                date: r.date,
                orderCount: r.order_count,
                revenue: Math.floor(r.revenue),
            })),
            previous: previous.map(r => ({
                date: r.date,
                orderCount: r.order_count,
                revenue: Math.floor(r.revenue),
            })),
            summary: {
                currentRevenue: Math.floor(currentTotal),
                previousRevenue: Math.floor(previousTotal),
                revenueGrowth: previousTotal > 0
                    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 10000) / 100
                    : null,
                currentOrders,
                previousOrders,
                orderGrowth: previousOrders > 0
                    ? Math.round(((currentOrders - previousOrders) / previousOrders) * 10000) / 100
                    : null,
            },
        }
    }

    async buildCustomReport(params: CustomReportParams) {
        const dimColumns = params.dimensions.map(d => DIMENSION_SQL[d])
        const dimSelects = params.dimensions.map((d, i) => `${dimColumns[i]} as ${d}`)

        const needsCommission = params.metrics.includes('commission')
        const metricSelects = params.metrics.map(m => `${METRIC_SQL[m]} as ${m}`)

        const conditions = [
            'o.created_at >= ?',
            "o.created_at <= ? || ' 23:59:59'",
        ]
        const bindings: unknown[] = [params.startDate, params.endDate]

        if (params.role !== 'admin') {
            conditions.push('o.distributor_id = ?')
            bindings.push(params.distributorId)
        }

        const commissionJoin = needsCommission
            ? 'LEFT JOIN (SELECT order_id, sku, SUM(commission_amount) as commission_amount FROM commission_settlements GROUP BY order_id, sku) cs ON cs.order_id = o.id AND cs.sku = oi.sku'
            : ''

        const sql = `
            SELECT ${[...dimSelects, ...metricSelects].join(', ')}
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN products p ON p.sku = oi.sku
            ${commissionJoin}
            WHERE ${conditions.join(' AND ')}
            GROUP BY ${dimColumns.join(', ')}
            ORDER BY ${dimColumns[0]} ASC
        `

        const { results } = await this.db.prepare(sql).bind(...bindings).all()

        return results.map(row => {
            const mapped: Record<string, unknown> = {}
            for (const d of params.dimensions) {
                mapped[d] = (row as Record<string, unknown>)[d]
            }
            for (const m of params.metrics) {
                const val = (row as Record<string, unknown>)[m]
                mapped[m] = typeof val === 'number' ? Math.floor(val) : val
            }
            return mapped
        })
    }
}
