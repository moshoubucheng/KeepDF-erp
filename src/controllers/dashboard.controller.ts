import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CacheService } from '../services/cache.service'

interface OrderStats {
    total_orders: number
    pending_orders: number
    processing_orders: number
    total_revenue: number
}

interface PlatformRow {
    platform: string
    order_count: number
    revenue: number
}

interface RevenueTrendRow {
    date: string
    order_count: number
    revenue: number
}

const VALID_PERIODS = ['7d', '30d', '90d', 'all'] as const
const VALID_GROUP_BY = ['day', 'week'] as const

const PERIOD_DAYS: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
}

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /dashboard/stats - 总览统计 */
dashboard.get('/stats', async (c) => {
    const distributorId = c.get('distributorId')
    const cache = new CacheService(c.env.KV)

    const stats = await cache.getOrFetch(`dashboard:stats:${distributorId}`, async () => {
        // Parallel queries instead of sequential
        const [orderStats, productStats, lowStockStats, wallet] = await Promise.all([
            c.env.DB.prepare(`
                SELECT
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
                    COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) as processing_orders,
                    COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) as total_revenue
                FROM orders
                WHERE distributor_id = ?
            `).bind(distributorId).first<OrderStats>(),
            c.env.DB.prepare(
                'SELECT COUNT(*) as total FROM products'
            ).first<{ total: number }>(),
            c.env.DB.prepare(
                'SELECT COUNT(*) as count FROM warehouse_locations WHERE qty <= 50'
            ).first<{ count: number }>(),
            c.env.DB.prepare(
                'SELECT balance, frozen_balance FROM distributors WHERE id = ?'
            ).bind(distributorId).first<{ balance: number; frozen_balance: number }>(),
        ])

        return {
            overview: {
                totalOrders: orderStats?.total_orders || 0,
                pendingOrders: orderStats?.pending_orders || 0,
                processingOrders: orderStats?.processing_orders || 0,
                totalRevenue: orderStats?.total_revenue || 0,
                totalProducts: productStats?.total || 0,
                lowStockCount: lowStockStats?.count || 0,
            },
            wallet: {
                balance: wallet?.balance || 0,
                frozen_balance: wallet?.frozen_balance || 0,
            },
        }
    }, 300) // 5 minute TTL

    return c.json(stats)
})

/** GET /dashboard/orders-by-platform - 按平台统计 */
dashboard.get('/orders-by-platform', async (c) => {
    const distributorId = c.get('distributorId')
    const period = c.req.query('period') || '30d'

    if (!VALID_PERIODS.includes(period as typeof VALID_PERIODS[number])) {
        return c.json({ error: 'Invalid period. Must be one of: 7d, 30d, 90d, all' }, 400)
    }

    let results: PlatformRow[]
    if (period === 'all') {
        const res = await c.env.DB.prepare(`
            SELECT
                platform,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM orders
            WHERE distributor_id = ?
            GROUP BY platform
            ORDER BY order_count DESC
        `).bind(distributorId).all<PlatformRow>()
        results = res.results
    } else {
        const days = PERIOD_DAYS[period]
        const res = await c.env.DB.prepare(`
            SELECT
                platform,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM orders
            WHERE distributor_id = ?
                AND created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY platform
            ORDER BY order_count DESC
        `).bind(distributorId, days).all<PlatformRow>()
        results = res.results
    }

    const totalOrders = results.reduce((s, r) => s + r.order_count, 0)
    const totalRevenue = results.reduce((s, r) => s + r.revenue, 0)

    const platforms = results.map((r) => ({
        platform: r.platform,
        orderCount: r.order_count,
        revenue: r.revenue,
        percentage: totalOrders > 0 ? Math.round((r.order_count / totalOrders) * 100) : 0,
    }))

    return c.json({
        period,
        platforms,
        total: { orders: totalOrders, revenue: totalRevenue },
    })
})

/** GET /dashboard/revenue-trend - 收入趋势 */
dashboard.get('/revenue-trend', async (c) => {
    const distributorId = c.get('distributorId')
    const period = c.req.query('period') || '30d'
    const groupBy = c.req.query('groupBy') || 'day'

    if (!VALID_PERIODS.includes(period as typeof VALID_PERIODS[number]) || period === 'all') {
        return c.json({ error: 'Invalid period. Must be one of: 7d, 30d, 90d' }, 400)
    }

    if (!VALID_GROUP_BY.includes(groupBy as typeof VALID_GROUP_BY[number])) {
        return c.json({ error: 'Invalid groupBy. Must be one of: day, week' }, 400)
    }

    const days = PERIOD_DAYS[period]

    // dateExpr 来自严格映射，无注入风险
    const dateExpr = groupBy === 'week'
        ? "strftime('%Y-W%W', created_at)"
        : 'DATE(created_at)'

    const { results } = await c.env.DB.prepare(`
        SELECT
            ${dateExpr} as date,
            COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE distributor_id = ?
            AND created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY ${dateExpr}
        ORDER BY date ASC
    `).bind(distributorId, days).all<RevenueTrendRow>()

    return c.json({
        period,
        groupBy,
        data: results.map((r) => ({
            date: r.date,
            orderCount: r.order_count,
            revenue: r.revenue,
        })),
    })
})

/** GET /dashboard/low-stock - 低库存商品 */
dashboard.get('/low-stock', async (c) => {
    const rawThreshold = Number(c.req.query('threshold') || 50)
    const rawLimit = Number(c.req.query('limit') || 20)

    const threshold = Number.isNaN(rawThreshold) ? 50 : Math.max(0, Math.min(rawThreshold, 10000))
    const limit = Number.isNaN(rawLimit) ? 20 : Math.max(1, Math.min(rawLimit, 200))

    const { results } = await c.env.DB.prepare(`
        SELECT
            p.id as product_id, p.sku, p.name_cn, p.name_jp,
            wl.code as location_code, wl.qty
        FROM warehouse_locations wl
        JOIN products p ON p.sku = wl.sku
        WHERE wl.qty <= ?
        ORDER BY wl.qty ASC
        LIMIT ?
    `).bind(threshold, limit).all()

    return c.json({
        threshold,
        products: results,
        count: results.length,
    })
})

export { dashboard }
