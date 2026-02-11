import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /dashboard/stats - 总览统计 */
dashboard.get('/stats', async (c) => {
    const distributorId = c.get('distributorId')

    const orderStats = await c.env.DB.prepare(`
        SELECT
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
            COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) as processing_orders,
            COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) as total_revenue
        FROM orders
        WHERE distributor_id = ?
    `).bind(distributorId).first<any>()

    const productStats = await c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM products'
    ).first<{ total: number }>()

    const lowStockStats = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM warehouse_locations WHERE qty <= 50'
    ).first<{ count: number }>()

    const wallet = await c.env.DB.prepare(
        'SELECT balance, frozen_balance FROM distributors WHERE id = ?'
    ).bind(distributorId).first<{ balance: number; frozen_balance: number }>()

    return c.json({
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
    })
})

/** GET /dashboard/orders-by-platform - 按平台统计 */
dashboard.get('/orders-by-platform', async (c) => {
    const distributorId = c.get('distributorId')
    const period = c.req.query('period') || '30d'

    let dateFilter = ''
    if (period !== 'all') {
        const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
        dateFilter = `AND created_at >= datetime('now', '-${days} days')`
    }

    const { results } = await c.env.DB.prepare(`
        SELECT
            platform,
            COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE distributor_id = ? ${dateFilter}
        GROUP BY platform
        ORDER BY order_count DESC
    `).bind(distributorId).all()

    const totalOrders = results.reduce((s: number, r: any) => s + (r.order_count as number), 0)
    const totalRevenue = results.reduce((s: number, r: any) => s + (r.revenue as number), 0)

    const platforms = results.map((r: any) => ({
        platform: r.platform,
        orderCount: r.order_count,
        revenue: r.revenue,
        percentage: totalOrders > 0 ? Math.round(((r.order_count as number) / totalOrders) * 100) : 0,
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

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30

    let dateExpr: string
    if (groupBy === 'week') {
        dateExpr = "strftime('%Y-W%W', created_at)"
    } else {
        dateExpr = 'DATE(created_at)'
    }

    const { results } = await c.env.DB.prepare(`
        SELECT
            ${dateExpr} as date,
            COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE distributor_id = ?
            AND created_at >= datetime('now', '-${days} days')
        GROUP BY ${dateExpr}
        ORDER BY date ASC
    `).bind(distributorId).all()

    return c.json({
        period,
        groupBy,
        data: results.map((r: any) => ({
            date: r.date,
            orderCount: r.order_count,
            revenue: r.revenue,
        })),
    })
})

/** GET /dashboard/low-stock - 低库存商品 */
dashboard.get('/low-stock', async (c) => {
    const threshold = Number(c.req.query('threshold') || 50)
    const limit = Number(c.req.query('limit') || 20)

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
