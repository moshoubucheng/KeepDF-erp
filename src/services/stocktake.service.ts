import { AuditService } from './audit.service'

const VALID_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
const STATUS_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
}

export class StocktakeService {
    private audit: AuditService

    constructor(private db: D1Database) {
        this.audit = new AuditService(db)
    }

    private async generateCode(): Promise<string> {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const result = await this.db.prepare(
            "SELECT COUNT(*) as cnt FROM stocktakes WHERE code LIKE ?"
        ).bind(`ST-${date}-%`).first<{ cnt: number }>()
        const seq = (result?.cnt || 0) + 1
        return `ST-${date}-${String(seq).padStart(3, '0')}`
    }

    async create(distributorId: number, notes?: string): Promise<any> {
        const code = await this.generateCode()

        const { meta } = await this.db.prepare(
            'INSERT INTO stocktakes (code, status, notes, distributor_id) VALUES (?, ?, ?, ?)'
        ).bind(code, 'DRAFT', notes || null, distributorId).run()

        const stocktakeId = meta.last_row_id

        // Auto-populate items from warehouse_locations
        const { results: locations } = await this.db.prepare(
            'SELECT sku, code as location_code, qty FROM warehouse_locations'
        ).bind().all<{ sku: string; location_code: string; qty: number }>()

        if (locations.length > 0) {
            const stmts = locations.map(loc =>
                this.db.prepare(
                    'INSERT INTO stocktake_items (stocktake_id, sku, location_code, expected_qty) VALUES (?, ?, ?, ?)'
                ).bind(stocktakeId, loc.sku, loc.location_code, loc.qty)
            )
            await this.db.batch(stmts)
        }

        await this.audit.log({
            distributorId, action: 'CREATE_STOCKTAKE' as any,
            resourceType: 'stocktake' as any, resourceId: String(stocktakeId),
            details: `Created stocktake ${code} with ${locations.length} items`,
        })

        return this.getDetail(stocktakeId)
    }

    async list(filters?: {
        status?: string
        limit?: number
        offset?: number
    }): Promise<{ stocktakes: any[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.status) {
            where += ' AND status = ?'
            params.push(filters.status.toUpperCase())
        }

        const countParams = [...params]
        const sql = `SELECT s.*,
                        (SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = s.id) as total_items,
                        (SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = s.id AND actual_qty IS NOT NULL AND COALESCE(actual_qty, 0) != expected_qty) as discrepancy_count
                     FROM stocktakes s ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)
        const countSql = `SELECT COUNT(*) as total FROM stocktakes ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { stocktakes: results, total: countResult?.total || 0 }
    }

    async getDetail(id: number): Promise<any | null> {
        const stocktake = await this.db.prepare(
            `SELECT s.*,
                    (SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = s.id) as total_items,
                    (SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = s.id AND actual_qty IS NOT NULL AND COALESCE(actual_qty, 0) != expected_qty) as discrepancy_count
             FROM stocktakes s WHERE s.id = ?`
        ).bind(id).first()
        if (!stocktake) return null

        const { results: items } = await this.db.prepare(
            `SELECT *, CASE WHEN actual_qty IS NOT NULL THEN actual_qty - expected_qty ELSE NULL END as discrepancy
             FROM stocktake_items WHERE stocktake_id = ? ORDER BY sku, location_code`
        ).bind(id).all()

        return { stocktake, items }
    }

    async start(id: number, distributorId: number): Promise<any> {
        const stocktake = await this.db.prepare('SELECT * FROM stocktakes WHERE id = ?').bind(id).first<any>()
        if (!stocktake) throw new Error('Stocktake not found')
        if (!STATUS_TRANSITIONS[stocktake.status]?.includes('IN_PROGRESS')) {
            throw new Error(`Cannot start stocktake in status: ${stocktake.status}`)
        }

        await this.db.prepare(
            'UPDATE stocktakes SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind('IN_PROGRESS', id).run()

        await this.audit.log({
            distributorId, action: 'UPDATE_STOCKTAKE' as any,
            resourceType: 'stocktake' as any, resourceId: String(id),
            details: `Started stocktake ${stocktake.code}`,
        })

        return this.getDetail(id)
    }

    async countItem(stocktakeId: number, sku: string, locationCode: string, actualQty: number, notes?: string): Promise<any> {
        const stocktake = await this.db.prepare('SELECT * FROM stocktakes WHERE id = ?').bind(stocktakeId).first<any>()
        if (!stocktake) throw new Error('Stocktake not found')
        if (stocktake.status !== 'IN_PROGRESS') throw new Error('Stocktake must be IN_PROGRESS to count items')

        const item = await this.db.prepare(
            'SELECT * FROM stocktake_items WHERE stocktake_id = ? AND sku = ? AND location_code = ?'
        ).bind(stocktakeId, sku, locationCode).first()

        if (item) {
            await this.db.prepare(
                'UPDATE stocktake_items SET actual_qty = ?, notes = ?, counted_at = CURRENT_TIMESTAMP WHERE stocktake_id = ? AND sku = ? AND location_code = ?'
            ).bind(actualQty, notes || null, stocktakeId, sku, locationCode).run()
        } else {
            await this.db.prepare(
                'INSERT INTO stocktake_items (stocktake_id, sku, location_code, expected_qty, actual_qty, notes, counted_at) VALUES (?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP)'
            ).bind(stocktakeId, sku, locationCode, actualQty, notes || null).run()
        }

        return this.db.prepare(
            'SELECT * FROM stocktake_items WHERE stocktake_id = ? AND sku = ? AND location_code = ?'
        ).bind(stocktakeId, sku, locationCode).first()
    }

    async complete(id: number, distributorId: number): Promise<any> {
        const stocktake = await this.db.prepare('SELECT * FROM stocktakes WHERE id = ?').bind(id).first<any>()
        if (!stocktake) throw new Error('Stocktake not found')
        if (!STATUS_TRANSITIONS[stocktake.status]?.includes('COMPLETED')) {
            throw new Error(`Cannot complete stocktake in status: ${stocktake.status}`)
        }

        // Get items with variance
        const { results: items } = await this.db.prepare(
            'SELECT * FROM stocktake_items WHERE stocktake_id = ? AND actual_qty IS NOT NULL'
        ).bind(id).all<any>()

        // Adjust warehouse_locations quantities + update status atomically
        const stmts: D1PreparedStatement[] = items.map(item =>
            this.db.prepare(
                'UPDATE warehouse_locations SET qty = ? WHERE sku = ? AND code = ?'
            ).bind(item.actual_qty, item.sku, item.location_code)
        )

        stmts.push(
            this.db.prepare(
                'UPDATE stocktakes SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind('COMPLETED', id)
        )

        await this.db.batch(stmts)

        await this.audit.log({
            distributorId, action: 'UPDATE_STOCKTAKE' as any,
            resourceType: 'stocktake' as any, resourceId: String(id),
            details: `Completed stocktake ${stocktake.code}, adjusted ${items.length} items`,
        })

        return this.getDetail(id)
    }

    async cancel(id: number, distributorId: number): Promise<any> {
        const stocktake = await this.db.prepare('SELECT * FROM stocktakes WHERE id = ?').bind(id).first<any>()
        if (!stocktake) throw new Error('Stocktake not found')
        if (!STATUS_TRANSITIONS[stocktake.status]?.includes('CANCELLED')) {
            throw new Error(`Cannot cancel stocktake in status: ${stocktake.status}`)
        }

        await this.db.prepare('UPDATE stocktakes SET status = ? WHERE id = ?').bind('CANCELLED', id).run()

        await this.audit.log({
            distributorId, action: 'UPDATE_STOCKTAKE' as any,
            resourceType: 'stocktake' as any, resourceId: String(id),
            details: `Cancelled stocktake ${stocktake.code}`,
        })

        return this.getDetail(id)
    }

    async getVarianceReport(id: number): Promise<any> {
        const stocktake = await this.db.prepare('SELECT * FROM stocktakes WHERE id = ?').bind(id).first()
        if (!stocktake) throw new Error('Stocktake not found')

        const { results: items } = await this.db.prepare(
            `SELECT si.*, p.name_jp, p.name_cn
             FROM stocktake_items si
             LEFT JOIN products p ON p.sku = si.sku
             WHERE si.stocktake_id = ? AND si.actual_qty IS NOT NULL
             ORDER BY ABS(COALESCE(si.actual_qty, 0) - si.expected_qty) DESC`
        ).bind(id).all()

        const totalVariance = items.reduce((sum: number, i: any) => sum + Math.abs((i.actual_qty || 0) - i.expected_qty), 0)
        const itemsWithVariance = items.filter((i: any) => (i.actual_qty || 0) !== i.expected_qty)

        return {
            stocktake,
            items,
            summary: {
                totalItems: items.length,
                itemsWithVariance: itemsWithVariance.length,
                totalVariance,
            },
        }
    }
}
