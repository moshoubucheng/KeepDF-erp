import type { InventoryForecast } from '../db/types'

export class ForecastingService {
    constructor(private db: D1Database) {}

    async getAll(filters?: {
        limit?: number
        offset?: number
    }): Promise<{ forecasts: InventoryForecast[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        const sql = `SELECT f.*, w.total_stock as current_stock, p.name_jp as product_name
                     FROM inventory_forecasts f
                     LEFT JOIN (SELECT sku, SUM(qty) as total_stock FROM warehouse_locations GROUP BY sku) w ON w.sku = f.sku
                     LEFT JOIN products p ON p.sku = f.sku
                     ORDER BY f.days_of_stock ASC
                     LIMIT ? OFFSET ?`

        const countSql = 'SELECT COUNT(*) as total FROM inventory_forecasts'

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(limit, offset).all(),
            this.db.prepare(countSql).first<{ total: number }>(),
        ])

        return { forecasts: results as any[], total: countResult?.total || 0 }
    }

    async getBySku(sku: string): Promise<any | null> {
        const forecast = await this.db.prepare(
            `SELECT f.*, w.total_stock as current_stock, p.name_jp as product_name, p.cost_price
             FROM inventory_forecasts f
             LEFT JOIN (SELECT sku, SUM(qty) as total_stock FROM warehouse_locations GROUP BY sku) w ON w.sku = f.sku
             LEFT JOIN products p ON p.sku = f.sku
             WHERE f.sku = ?`
        ).bind(sku).first()

        if (!forecast) return null

        // Get recent order history for this SKU
        const { results: recentOrders } = await this.db.prepare(
            `SELECT oi.qty, o.created_at, o.status
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.sku = ? AND o.status IN ('SHIPPED','DELIVERED')
             ORDER BY o.created_at DESC LIMIT 30`
        ).bind(sku).all()

        return { ...forecast, recent_orders: recentOrders }
    }

    async getReorderSuggestions(): Promise<any[]> {
        const { results } = await this.db.prepare(
            `SELECT f.*, w.total_stock as current_stock, p.name_jp as product_name, p.cost_price,
                    MIN(s.name) as supplier_name, MIN(s.lead_time_days) as supplier_lead_time
             FROM inventory_forecasts f
             LEFT JOIN (SELECT sku, SUM(qty) as total_stock FROM warehouse_locations GROUP BY sku) w ON w.sku = f.sku
             LEFT JOIN products p ON p.sku = f.sku
             LEFT JOIN purchase_order_items poi ON poi.sku = f.sku
             LEFT JOIN purchase_orders po ON po.id = poi.po_id AND po.status IN ('DRAFT','SUBMITTED','CONFIRMED','SHIPPED')
             LEFT JOIN suppliers s ON s.id = po.supplier_id
             WHERE COALESCE(w.total_stock, 0) <= f.reorder_point AND f.daily_velocity > 0
             GROUP BY f.sku
             ORDER BY f.days_of_stock ASC`
        ).all()

        return results.map((r: any) => ({
            ...r,
            suggested_qty: Math.max(
                Math.ceil((r.daily_velocity || 0) * (r.lead_time_days || 7) * 2) - (r.current_stock || 0),
                0
            ),
        }))
    }

    async calculate(): Promise<{ calculated: number }> {
        // Batch-fetch all data in 3+1 parallel queries instead of 3N sequential queries
        const [{ results: skus }, salesRes, stockRes, supplierRes] = await Promise.all([
            this.db.prepare('SELECT DISTINCT sku FROM warehouse_locations').all<{ sku: string }>(),
            this.db.prepare(
                `SELECT oi.sku, COALESCE(SUM(oi.qty), 0) as total_qty
                 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE o.status IN ('SHIPPED','DELIVERED') AND o.created_at >= datetime('now', '-30 days')
                 GROUP BY oi.sku`
            ).all<{ sku: string; total_qty: number }>(),
            this.db.prepare(
                'SELECT sku, COALESCE(SUM(qty), 0) as total FROM warehouse_locations GROUP BY sku'
            ).all<{ sku: string; total: number }>(),
            this.db.prepare(
                `SELECT poi.sku, MIN(s.lead_time_days) as min_lead
                 FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.po_id
                 JOIN suppliers s ON s.id = po.supplier_id WHERE s.is_active = 1
                 GROUP BY poi.sku`
            ).all<{ sku: string; min_lead: number | null }>(),
        ])

        // Build lookup maps
        const salesMap = new Map(salesRes.results.map(r => [r.sku, r.total_qty]))
        const stockMap = new Map(stockRes.results.map(r => [r.sku, r.total]))
        const leadMap = new Map(supplierRes.results.map(r => [r.sku, r.min_lead]))

        let calculated = 0
        const stmts: D1PreparedStatement[] = []

        for (const { sku } of skus) {
            const totalQty = salesMap.get(sku) || 0
            const dailyVelocity = totalQty / 30
            const weeklyVelocity = dailyVelocity * 7

            const currentStock = stockMap.get(sku) || 0
            const daysOfStock = dailyVelocity > 0 ? currentStock / dailyVelocity : 9999

            const leadTimeDays = leadMap.get(sku) || 7
            const safetyStock = Math.ceil(dailyVelocity * 3) // 3 days safety
            const reorderPoint = Math.ceil(dailyVelocity * leadTimeDays) + safetyStock

            stmts.push(
                this.db.prepare(
                    `INSERT INTO inventory_forecasts (sku, daily_velocity, weekly_velocity, days_of_stock, reorder_point, safety_stock, lead_time_days, calculated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(sku) DO UPDATE SET
                       daily_velocity = excluded.daily_velocity,
                       weekly_velocity = excluded.weekly_velocity,
                       days_of_stock = excluded.days_of_stock,
                       reorder_point = excluded.reorder_point,
                       safety_stock = excluded.safety_stock,
                       lead_time_days = excluded.lead_time_days,
                       calculated_at = CURRENT_TIMESTAMP`
                ).bind(sku, Math.round(dailyVelocity * 100) / 100, Math.round(weeklyVelocity * 100) / 100, Math.round(daysOfStock * 10) / 10, reorderPoint, safetyStock, leadTimeDays)
            )

            calculated++
        }

        if (stmts.length > 0) {
            // Batch in groups of 20 (D1 batch limit)
            for (let i = 0; i < stmts.length; i += 20) {
                await this.db.batch(stmts.slice(i, i + 20))
            }
        }

        return { calculated }
    }
}
