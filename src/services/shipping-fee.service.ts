import { AuditService } from './audit.service'

const VALID_CARRIERS = ['YAMATO', 'SAGAWA', 'JP_POST', 'EMS', 'OTHER'] as const
const VALID_REGIONS = ['DOMESTIC', 'ASIA', 'US_EU', 'OTHER'] as const

export class ShippingFeeService {
    private audit: AuditService

    constructor(private db: D1Database) {
        this.audit = new AuditService(db)
    }

    async listTemplates(filters?: {
        carrier?: string
        region?: string
        platform?: string
        is_active?: number
    }): Promise<{ templates: any[]; total: number }> {
        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.carrier) {
            where += ' AND carrier = ?'
            params.push(filters.carrier.toUpperCase())
        }
        if (filters?.region) {
            where += ' AND region = ?'
            params.push(filters.region.toUpperCase())
        }
        if (filters?.platform) {
            where += ' AND (platform = ? OR platform IS NULL)'
            params.push(filters.platform.toUpperCase())
        }
        if (filters?.is_active !== undefined) {
            where += ' AND is_active = ?'
            params.push(filters.is_active)
        }

        const countParams = [...params]
        const countSql = `SELECT COUNT(*) as total FROM shipping_fee_templates ${where}`
        const sql = `SELECT * FROM shipping_fee_templates ${where} ORDER BY created_at DESC`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { templates: results, total: countResult?.total || 0 }
    }

    async createTemplate(data: {
        name: string
        carrier: string
        region?: string
        weight_min_g?: number
        weight_max_g?: number
        base_fee: number
        per_kg_fee?: number
        platform?: string
    }, distributorId: number): Promise<any> {
        if (!data.name || !data.carrier) throw new Error('name and carrier are required')
        if (!VALID_CARRIERS.includes(data.carrier.toUpperCase() as any)) {
            throw new Error(`Invalid carrier. Must be one of: ${VALID_CARRIERS.join(', ')}`)
        }
        if (data.region && !VALID_REGIONS.includes(data.region.toUpperCase() as any)) {
            throw new Error(`Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}`)
        }

        const { meta } = await this.db.prepare(
            `INSERT INTO shipping_fee_templates (name, carrier, region, weight_min_g, weight_max_g, base_fee, per_kg_fee, platform)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.name,
            data.carrier.toUpperCase(),
            data.region?.toUpperCase() || 'DOMESTIC',
            data.weight_min_g || 0,
            data.weight_max_g || 999999,
            data.base_fee,
            data.per_kg_fee || 0,
            data.platform?.toUpperCase() || null,
        ).run()

        await this.audit.log({
            distributorId, action: 'CREATE_SHIPPING_TEMPLATE' as any,
            resourceType: 'shipping_fee' as any, resourceId: String(meta.last_row_id),
            details: `Created template: ${data.name}`,
        })

        return this.db.prepare('SELECT * FROM shipping_fee_templates WHERE id = ?').bind(meta.last_row_id).first()
    }

    async updateTemplate(id: number, data: Partial<{
        name: string; carrier: string; region: string
        weight_min_g: number; weight_max_g: number
        base_fee: number; per_kg_fee: number
        platform: string | null; is_active: number
    }>, distributorId: number): Promise<any> {
        const existing = await this.db.prepare('SELECT * FROM shipping_fee_templates WHERE id = ?').bind(id).first()
        if (!existing) return null

        const fields: string[] = []
        const binds: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); binds.push(data.name) }
        if (data.carrier !== undefined) { fields.push('carrier = ?'); binds.push(data.carrier.toUpperCase()) }
        if (data.region !== undefined) { fields.push('region = ?'); binds.push(data.region.toUpperCase()) }
        if (data.weight_min_g !== undefined) { fields.push('weight_min_g = ?'); binds.push(data.weight_min_g) }
        if (data.weight_max_g !== undefined) { fields.push('weight_max_g = ?'); binds.push(data.weight_max_g) }
        if (data.base_fee !== undefined) { fields.push('base_fee = ?'); binds.push(data.base_fee) }
        if (data.per_kg_fee !== undefined) { fields.push('per_kg_fee = ?'); binds.push(data.per_kg_fee) }
        if (data.platform !== undefined) { fields.push('platform = ?'); binds.push(data.platform) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); binds.push(data.is_active) }

        if (fields.length === 0) return existing
        binds.push(id)

        await this.db.prepare(`UPDATE shipping_fee_templates SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()

        await this.audit.log({
            distributorId, action: 'UPDATE_SHIPPING_TEMPLATE' as any,
            resourceType: 'shipping_fee' as any, resourceId: String(id),
        })

        return this.db.prepare('SELECT * FROM shipping_fee_templates WHERE id = ?').bind(id).first()
    }

    async deleteTemplate(id: number, distributorId: number): Promise<boolean> {
        const { meta } = await this.db.prepare(
            'UPDATE shipping_fee_templates SET is_active = 0 WHERE id = ? AND is_active = 1'
        ).bind(id).run()

        if ((meta.changes ?? 0) > 0) {
            await this.audit.log({
                distributorId, action: 'DELETE_SHIPPING_TEMPLATE' as any,
                resourceType: 'shipping_fee' as any, resourceId: String(id),
            })
        }
        return (meta.changes ?? 0) > 0
    }

    async estimateFee(orderId: number): Promise<{ estimated_fee: number; template: any } | null> {
        const order = await this.db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<any>()
        if (!order) return null

        // Find matching template
        const template = await this.db.prepare(
            `SELECT * FROM shipping_fee_templates
             WHERE is_active = 1
               AND (platform IS NULL OR platform = ?)
             ORDER BY priority DESC, base_fee ASC
             LIMIT 1`
        ).bind(order.platform || '').first<any>()

        if (!template) return null

        const estimatedFee = template.base_fee + Math.floor((template.per_kg_fee || 0) * ((order.weight_g || 0) / 1000))
        return { estimated_fee: estimatedFee, template }
    }

    async recordFee(orderId: number, data: {
        carrier: string
        tracking_number?: string
        actual_fee: number
        estimated_fee?: number
        weight_g?: number
        template_id?: number
    }, distributorId: number): Promise<any> {
        if (!data.carrier || data.actual_fee === undefined) throw new Error('carrier and actual_fee are required')

        const { meta } = await this.db.prepare(
            `INSERT INTO shipping_fees (order_id, template_id, carrier, tracking_number, actual_fee, estimated_fee, weight_g, distributor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            orderId,
            data.template_id || null,
            data.carrier.toUpperCase(),
            data.tracking_number || null,
            data.actual_fee,
            data.estimated_fee || 0,
            data.weight_g || null,
            distributorId,
        ).run()

        return this.db.prepare('SELECT * FROM shipping_fees WHERE id = ?').bind(meta.last_row_id).first()
    }

    async getOrderFees(orderId: number, distributorId: number, role: string): Promise<any[]> {
        let sql = 'SELECT sf.*, sft.name as template_name FROM shipping_fees sf LEFT JOIN shipping_fee_templates sft ON sft.id = sf.template_id WHERE sf.order_id = ?'
        const params: (number)[] = [orderId]
        if (role !== 'admin') {
            sql += ' AND sf.distributor_id = ?'
            params.push(distributorId)
        }
        const { results } = await this.db.prepare(sql).bind(...params).all()
        return results
    }

    async reconcile(ids: number[], distributorId: number): Promise<{ reconciled: number }> {
        if (!ids.length) throw new Error('No IDs provided')

        let reconciled = 0
        for (const id of ids) {
            const { meta } = await this.db.prepare(
                'UPDATE shipping_fees SET reconciled = 1, reconciled_at = CURRENT_TIMESTAMP WHERE id = ? AND reconciled = 0'
            ).bind(id).run()
            reconciled += meta.changes ?? 0
        }

        await this.audit.log({
            distributorId, action: 'BATCH_UPDATE' as any,
            resourceType: 'shipping_fee' as any,
            details: `Reconciled ${reconciled} shipping fees`,
        })

        return { reconciled }
    }

    async getReconciliationReport(params?: {
        platform?: string
        startDate?: string
        endDate?: string
    }): Promise<any> {
        let where = 'WHERE 1=1'
        const binds: (string | number)[] = []

        if (params?.startDate) { where += ' AND sf.created_at >= ?'; binds.push(params.startDate) }
        if (params?.endDate) { where += ' AND sf.created_at <= ?'; binds.push(params.endDate) }

        const sql = `
            SELECT
                o.platform,
                COUNT(*) as total_shipments,
                SUM(sf.actual_fee) as total_actual,
                SUM(sf.estimated_fee) as total_estimated,
                SUM(CASE WHEN sf.reconciled = 1 THEN 1 ELSE 0 END) as reconciled_count,
                SUM(CASE WHEN sf.reconciled = 0 THEN 1 ELSE 0 END) as unreconciled_count,
                SUM(sf.actual_fee - sf.estimated_fee) as total_variance
            FROM shipping_fees sf
            LEFT JOIN orders o ON o.id = sf.order_id
            ${where}
            GROUP BY o.platform
        `

        const { results } = await this.db.prepare(sql).bind(...binds).all()
        return { report: results }
    }
}
