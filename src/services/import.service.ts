/**
 * ImportService - CSV parsing, bulk import, batch status update
 */
import { NotificationCenterService } from './notification-center.service'

export class ImportService {
    private notificationCenter: NotificationCenterService

    constructor(private db: D1Database) {
        this.notificationCenter = new NotificationCenterService(db)
    }

    /** Parse CSV text into rows */
    parseCSV(csvText: string): Record<string, string>[] {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) return []

        const headers = this.parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
        const rows: Record<string, string>[] = []

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i])
            const row: Record<string, string> = {}
            headers.forEach((h, idx) => {
                row[h] = values[idx]?.trim() || ''
            })
            rows.push(row)
        }

        return rows
    }

    /** Parse a single CSV line respecting quoted fields */
    private parseCSVLine(line: string): string[] {
        const result: string[] = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (inQuotes) {
                if (char === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        current += '"'
                        i++
                    } else {
                        inQuotes = false
                    }
                } else {
                    current += char
                }
            } else {
                if (char === '"') {
                    inQuotes = true
                } else if (char === ',') {
                    result.push(current)
                    current = ''
                } else {
                    current += char
                }
            }
        }
        result.push(current)
        return result
    }

    /** Import products from CSV */
    async importProducts(csvText: string, distributorId: number): Promise<{ total: number; success: number; errors: { row: number; error: string }[] }> {
        const rows = this.parseCSV(csvText)
        let success = 0
        const errors: { row: number; error: string }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                const sku = row.sku
                const costPrice = Number(row.cost_price || row.price)

                if (!sku) throw new Error('SKU is required')
                if (!costPrice || costPrice <= 0) throw new Error('Valid cost_price is required')

                await this.db.prepare(
                    `INSERT INTO products (sku, name_cn, name_jp, cost_price, tax_category)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(sku) DO UPDATE SET
                       name_cn = COALESCE(?, name_cn),
                       name_jp = COALESCE(?, name_jp),
                       cost_price = ?,
                       tax_category = ?`
                ).bind(
                    sku,
                    row.name_cn || null,
                    row.name_jp || null,
                    costPrice,
                    row.tax_category || 'standard',
                    row.name_cn || null,
                    row.name_jp || null,
                    costPrice,
                    row.tax_category || 'standard',
                ).run()

                success++
            } catch (e: any) {
                errors.push({ row: i + 2, error: e.message })
            }
        }

        // Log import
        await this.logImport('PRODUCTS', 'products.csv', rows.length, success, errors.length, errors, distributorId)

        // Notify
        try {
            await this.notificationCenter.notifyImportComplete(distributorId, 'Products', success, errors.length)
        } catch (e) {
            console.error('[IMPORT] Notification failed:', e)
        }

        return { total: rows.length, success, errors }
    }

    /** Import orders from CSV */
    async importOrders(csvText: string, distributorId: number): Promise<{ total: number; success: number; errors: { row: number; error: string }[] }> {
        const rows = this.parseCSV(csvText)
        let success = 0
        const errors: { row: number; error: string }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                const platform = (row.platform || '').toUpperCase()
                const orderId = row.platform_order_id || row.order_id
                const total = Number(row.total_amount || row.total)

                if (!platform || !['TIKTOK', 'TEMU', 'RAKUTEN'].includes(platform)) {
                    throw new Error('Valid platform is required (TIKTOK, TEMU, RAKUTEN)')
                }
                if (!orderId) throw new Error('platform_order_id is required')
                if (!total || total <= 0) throw new Error('Valid total_amount is required')

                await this.db.prepare(
                    `INSERT INTO orders (platform, platform_order_id, status, total_amount, tax_total, distributor_id)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(
                    platform,
                    orderId,
                    row.status || 'PENDING',
                    total,
                    Number(row.tax_total) || 0,
                    distributorId,
                ).run()

                success++
            } catch (e: any) {
                errors.push({ row: i + 2, error: e.message })
            }
        }

        // Log import
        await this.logImport('ORDERS', 'orders.csv', rows.length, success, errors.length, errors, distributorId)

        // Notify
        try {
            await this.notificationCenter.notifyImportComplete(distributorId, 'Orders', success, errors.length)
        } catch (e) {
            console.error('[IMPORT] Notification failed:', e)
        }

        return { total: rows.length, success, errors }
    }

    /** Batch update order statuses */
    async batchUpdateStatus(updates: { order_id: number; status: string }[], distributorId: number, role: string): Promise<{ success: number; errors: { order_id: number; error: string }[] }> {
        const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
        let success = 0
        const errors: { order_id: number; error: string }[] = []

        for (const update of updates) {
            try {
                if (!validStatuses.includes(update.status.toUpperCase())) {
                    throw new Error(`Invalid status: ${update.status}`)
                }

                let sql = 'UPDATE orders SET status = ? WHERE id = ?'
                const binds: (string | number)[] = [update.status.toUpperCase(), update.order_id]

                if (role !== 'admin') {
                    sql += ' AND distributor_id = ?'
                    binds.push(distributorId)
                }

                const { meta } = await this.db.prepare(sql).bind(...binds).run()
                if ((meta.changes ?? 0) === 0) throw new Error('Order not found or not authorized')
                success++
            } catch (e: any) {
                errors.push({ order_id: update.order_id, error: e.message })
            }
        }

        return { success, errors }
    }

    /** Get import logs */
    async getLogs(distributorId: number, role: string, limit = 50): Promise<any[]> {
        let sql = 'SELECT * FROM import_logs'
        const binds: (string | number)[] = []

        if (role !== 'admin') {
            sql += ' WHERE distributor_id = ?'
            binds.push(distributorId)
        }

        sql += ' ORDER BY created_at DESC LIMIT ?'
        binds.push(Math.min(limit, 200))

        const { results } = await this.db.prepare(sql).bind(...binds).all()
        return results
    }

    /** Generate CSV template for products */
    getProductTemplate(): string {
        return 'sku,name_jp,name_cn,cost_price,tax_category\r\nSAMPLE-SKU,サンプル商品,示例商品,1000,standard'
    }

    /** Generate CSV template for orders */
    getOrderTemplate(): string {
        return 'platform,platform_order_id,total_amount,tax_total,status\r\nTIKTOK,TT-ORD-001,5000,500,PENDING'
    }

    /** Log an import operation */
    private async logImport(type: string, filename: string, total: number, success: number, errorCount: number, errors: any[], distributorId: number): Promise<void> {
        try {
            await this.db.prepare(
                `INSERT INTO import_logs (type, filename, total_rows, success_count, error_count, error_details, distributor_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                type,
                filename,
                total,
                success,
                errorCount,
                errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null,
                distributorId,
            ).run()
        } catch (e) {
            console.error('[IMPORT] Failed to log import:', e)
        }
    }
}
