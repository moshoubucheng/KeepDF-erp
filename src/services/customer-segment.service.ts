export class CustomerSegmentService {
    constructor(private db: D1Database) {}

    async calculateRFM(distributorId: number, role: string): Promise<any[]> {
        let where = ''
        const params: number[] = []
        if (role !== 'admin') {
            where = 'WHERE c.distributor_id = ?'
            params.push(distributorId)
        }

        // Get all customers with order aggregations
        const sql = `
            SELECT c.id, c.name, c.email, c.platform, c.tags,
                COALESCE(MAX(o.created_at), '') as last_order_date,
                COUNT(o.id) as order_count,
                COALESCE(SUM(o.total_amount), 0) as total_spent
            FROM customers c
            LEFT JOIN orders o ON o.customer_id = c.id AND o.status IN ('PROCESSING','SHIPPED','DELIVERED')
            ${where}
            GROUP BY c.id
        `

        const { results: customers } = await this.db.prepare(sql).bind(...params).all<any>()
        if (customers.length === 0) return []

        // Calculate R, F, M scores using quintile
        const recencies: number[] = []
        const frequencies: number[] = []
        const monetaries: number[] = []

        const now = Date.now()
        const enriched = customers.map(c => {
            const daysSinceLast = c.last_order_date
                ? Math.floor((now - new Date(c.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : 9999
            recencies.push(daysSinceLast)
            frequencies.push(c.order_count)
            monetaries.push(c.total_spent)
            return { ...c, days_since_last: daysSinceLast }
        })

        const getQuintile = (values: number[], value: number, inverse = false): number => {
            const sorted = [...values].sort((a, b) => a - b)
            const idx = sorted.indexOf(value)
            const pct = idx / Math.max(sorted.length - 1, 1)
            const score = Math.ceil(pct * 5) || 1
            return inverse ? (6 - score) : score
        }

        return enriched.map(c => ({
            customer_id: c.id,
            name: c.name,
            email: c.email,
            platform: c.platform,
            tags: c.tags,
            last_order_date: c.last_order_date || null,
            order_count: c.order_count,
            total_spent: c.total_spent,
            days_since_last: c.days_since_last,
            r_score: getQuintile(recencies, c.days_since_last, true),
            f_score: getQuintile(frequencies, c.order_count),
            m_score: getQuintile(monetaries, c.total_spent),
            rfm_score: `${getQuintile(recencies, c.days_since_last, true)}${getQuintile(frequencies, c.order_count)}${getQuintile(monetaries, c.total_spent)}`,
        }))
    }

    async getRFMDistribution(distributorId: number, role: string): Promise<any> {
        const rfmData = await this.calculateRFM(distributorId, role)

        const distribution: Record<string, number> = {}
        const segments = {
            champions: 0,
            loyal: 0,
            potential: 0,
            new_customers: 0,
            at_risk: 0,
            lost: 0,
        }

        for (const c of rfmData) {
            const key = c.rfm_score
            distribution[key] = (distribution[key] || 0) + 1

            const r = c.r_score
            const f = c.f_score
            const m = c.m_score

            if (r >= 4 && f >= 4 && m >= 4) segments.champions++
            else if (f >= 4 && m >= 3) segments.loyal++
            else if (r >= 4 && f <= 2) segments.new_customers++
            else if (r >= 3 && f >= 2) segments.potential++
            else if (r <= 2 && f >= 3) segments.at_risk++
            else if (r <= 2 && f <= 2) segments.lost++
        }

        return { total: rfmData.length, distribution, segments }
    }

    async listSegments(distributorId: number, role: string): Promise<any[]> {
        let sql = 'SELECT * FROM customer_segments'
        const params: number[] = []
        if (role !== 'admin') {
            sql += ' WHERE distributor_id = ?'
            params.push(distributorId)
        }
        sql += ' ORDER BY created_at DESC'

        const { results } = await this.db.prepare(sql).bind(...params).all()
        return results
    }

    async createSegment(data: {
        name: string
        description?: string
        rules: any
        color?: string
        auto_update?: number
    }, distributorId: number): Promise<any> {
        if (!data.name) throw new Error('name is required')

        const { meta } = await this.db.prepare(
            `INSERT INTO customer_segments (name, description, rules, color, auto_update, distributor_id)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            data.name,
            data.description || null,
            JSON.stringify(data.rules || {}),
            data.color || '#8b5cf6',
            data.auto_update ?? 1,
            distributorId,
        ).run()

        return this.db.prepare('SELECT * FROM customer_segments WHERE id = ?').bind(meta.last_row_id).first()
    }

    async updateSegment(id: number, data: Partial<{
        name: string; description: string
        rules: any; color: string; auto_update: number
    }>, distributorId: number, role: string): Promise<any | null> {
        let sql = 'SELECT * FROM customer_segments WHERE id = ?'
        const params: (number)[] = [id]
        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }
        const existing = await this.db.prepare(sql).bind(...params).first()
        if (!existing) return null

        const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
        const binds: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); binds.push(data.name) }
        if (data.description !== undefined) { fields.push('description = ?'); binds.push(data.description) }
        if (data.rules !== undefined) { fields.push('rules = ?'); binds.push(JSON.stringify(data.rules)) }
        if (data.color !== undefined) { fields.push('color = ?'); binds.push(data.color) }
        if (data.auto_update !== undefined) { fields.push('auto_update = ?'); binds.push(data.auto_update) }

        binds.push(id)
        await this.db.prepare(`UPDATE customer_segments SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()

        return this.db.prepare('SELECT * FROM customer_segments WHERE id = ?').bind(id).first()
    }

    async deleteSegment(id: number, distributorId: number, role: string): Promise<boolean> {
        let sql = 'DELETE FROM customer_segments WHERE id = ?'
        const params: number[] = [id]
        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }
        const { meta } = await this.db.prepare(sql).bind(...params).run()
        return (meta.changes ?? 0) > 0
    }

    async getSegmentCustomers(segmentId: number, distributorId: number, role: string, limit = 50, offset = 0): Promise<any> {
        let segSql = 'SELECT * FROM customer_segments WHERE id = ?'
        const segParams: number[] = [segmentId]
        if (role !== 'admin') {
            segSql += ' AND distributor_id = ?'
            segParams.push(distributorId)
        }
        const segment = await this.db.prepare(segSql).bind(...segParams).first<any>()
        if (!segment) return null

        const rules = JSON.parse(segment.rules || '{}')
        const rfmData = await this.calculateRFM(distributorId, role)

        // Filter by rules
        const matching = rfmData.filter(c => {
            if (rules.rfm_min && c.rfm_score < rules.rfm_min) return false
            if (rules.rfm_max && c.rfm_score > rules.rfm_max) return false
            if (rules.min_orders && c.order_count < rules.min_orders) return false
            if (rules.min_spent && c.total_spent < rules.min_spent) return false
            if (rules.platform && c.platform !== rules.platform) return false
            if (rules.tags?.length) {
                const customerTags = JSON.parse(c.tags || '[]')
                if (!rules.tags.some((t: string) => customerTags.includes(t))) return false
            }
            return true
        })

        return {
            segment,
            customers: matching.slice(offset, offset + limit),
            total: matching.length,
        }
    }

    async refreshSegmentCounts(distributorId: number, role: string): Promise<void> {
        const segments = await this.listSegments(distributorId, role)
        const rfmData = await this.calculateRFM(distributorId, role)

        for (const seg of segments as any[]) {
            const rules = JSON.parse(seg.rules || '{}')
            const count = rfmData.filter(c => {
                if (rules.rfm_min && c.rfm_score < rules.rfm_min) return false
                if (rules.rfm_max && c.rfm_score > rules.rfm_max) return false
                if (rules.min_orders && c.order_count < rules.min_orders) return false
                if (rules.min_spent && c.total_spent < rules.min_spent) return false
                if (rules.platform && c.platform !== rules.platform) return false
                return true
            }).length

            await this.db.prepare(
                'UPDATE customer_segments SET customer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(count, seg.id).run()
        }
    }
}
