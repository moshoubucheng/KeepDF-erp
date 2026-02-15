/**
 * CustomerService - Customer CRUD + statistics
 */
export class CustomerService {
    constructor(private db: D1Database) {}

    /** List customers with search/filter/pagination */
    async list(params: {
        distributorId: number
        role: string
        search?: string
        tag?: string
        limit?: number
        offset?: number
    }): Promise<{ customers: any[]; total: number }> {
        const limit = Math.min(Math.max(1, params.limit || 50), 200)
        const offset = Math.max(0, params.offset || 0)

        let where = '1=1'
        const binds: (string | number)[] = []

        if (params.role !== 'admin') {
            where += ' AND distributor_id = ?'
            binds.push(params.distributorId)
        }

        if (params.search) {
            where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'
            const q = `%${params.search}%`
            binds.push(q, q, q)
        }

        if (params.tag) {
            where += ' AND tags LIKE ?'
            binds.push(`%${params.tag}%`)
        }

        const countBinds = [...binds]

        const sql = `SELECT * FROM customers WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        binds.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM customers WHERE ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...binds).all(),
            this.db.prepare(countSql).bind(...countBinds).first<{ total: number }>(),
        ])

        return { customers: results, total: countResult?.total || 0 }
    }

    /** Get customer detail with order stats */
    async getDetail(id: number, distributorId: number, role: string): Promise<any | null> {
        let sql = 'SELECT * FROM customers WHERE id = ?'
        const binds: (string | number)[] = [id]

        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            binds.push(distributorId)
        }

        const customer = await this.db.prepare(sql).bind(...binds).first()
        if (!customer) return null

        const stats = await this.db.prepare(
            `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_spent
             FROM orders WHERE customer_id = ?`
        ).bind(id).first<{ order_count: number; total_spent: number }>()

        return {
            ...customer,
            order_count: stats?.order_count || 0,
            total_spent: stats?.total_spent || 0,
        }
    }

    /** Get customer orders */
    async getOrders(customerId: number, distributorId: number, role: string, limit = 50): Promise<any[]> {
        let sql = 'SELECT * FROM orders WHERE customer_id = ?'
        const binds: (string | number)[] = [customerId]

        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            binds.push(distributorId)
        }

        sql += ' ORDER BY created_at DESC LIMIT ?'
        binds.push(Math.min(limit, 200))

        const { results } = await this.db.prepare(sql).bind(...binds).all()
        return results
    }

    /** Create customer */
    async create(params: {
        name: string
        email?: string
        phone?: string
        address_line1?: string
        address_line2?: string
        city?: string
        prefecture?: string
        postal_code?: string
        country?: string
        platform?: string
        platform_customer_id?: string
        tags?: string[]
        notes?: string
        distributor_id: number
    }): Promise<any> {
        const { meta } = await this.db.prepare(
            `INSERT INTO customers (name, email, phone, address_line1, address_line2, city, prefecture, postal_code, country, platform, platform_customer_id, tags, notes, distributor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            params.name,
            params.email || null,
            params.phone || null,
            params.address_line1 || null,
            params.address_line2 || null,
            params.city || null,
            params.prefecture || null,
            params.postal_code || null,
            params.country || 'JP',
            params.platform || null,
            params.platform_customer_id || null,
            JSON.stringify(params.tags || []),
            params.notes || null,
            params.distributor_id,
        ).run()

        return this.db.prepare('SELECT * FROM customers WHERE id = ?')
            .bind(meta.last_row_id).first()
    }

    /** Update customer */
    async update(id: number, distributorId: number, role: string, params: Record<string, any>): Promise<any | null> {
        // Verify ownership
        let checkSql = 'SELECT id FROM customers WHERE id = ?'
        const checkBinds: (string | number)[] = [id]
        if (role !== 'admin') {
            checkSql += ' AND distributor_id = ?'
            checkBinds.push(distributorId)
        }

        const existing = await this.db.prepare(checkSql).bind(...checkBinds).first()
        if (!existing) return null

        const fields: string[] = []
        const values: (string | number | null)[] = []

        const allowedFields = ['name', 'email', 'phone', 'address_line1', 'address_line2', 'city', 'prefecture', 'postal_code', 'country', 'platform', 'platform_customer_id', 'notes']
        for (const field of allowedFields) {
            if (params[field] !== undefined) {
                fields.push(`${field} = ?`)
                values.push(params[field])
            }
        }

        if (params.tags !== undefined) {
            fields.push('tags = ?')
            values.push(JSON.stringify(params.tags))
        }

        if (fields.length === 0) return this.db.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()

        values.push(id)
        await this.db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()

        return this.db.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
    }
}
