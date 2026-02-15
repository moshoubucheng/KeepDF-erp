import type { Supplier } from '../db/types'

export class SupplierService {
    constructor(private db: D1Database) {}

    async list(filters?: {
        isActive?: number
        limit?: number
        offset?: number
    }): Promise<{ suppliers: Supplier[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.isActive !== undefined) {
            where += ' AND is_active = ?'
            params.push(filters.isActive)
        }

        const countParams = [...params]

        const sql = `SELECT * FROM suppliers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM suppliers ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all<Supplier>(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { suppliers: results, total: countResult?.total || 0 }
    }

    async getById(id: number): Promise<Supplier | null> {
        return this.db.prepare('SELECT * FROM suppliers WHERE id = ?')
            .bind(id).first<Supplier>()
    }

    async create(data: {
        name: string
        contact_name?: string
        contact_email?: string
        contact_phone?: string
        address?: string
        payment_terms?: string
        lead_time_days?: number
        notes?: string
    }): Promise<Supplier> {
        if (!data.name?.trim()) throw new Error('Supplier name is required')

        const { meta } = await this.db.prepare(
            `INSERT INTO suppliers (name, contact_name, contact_email, contact_phone, address, payment_terms, lead_time_days, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.name.trim(),
            data.contact_name || null,
            data.contact_email || null,
            data.contact_phone || null,
            data.address || null,
            data.payment_terms || null,
            data.lead_time_days || 7,
            data.notes || null,
        ).run()

        return this.db.prepare('SELECT * FROM suppliers WHERE id = ?')
            .bind(meta.last_row_id).first<Supplier>() as Promise<Supplier>
    }

    async update(id: number, data: Partial<{
        name: string
        contact_name: string
        contact_email: string
        contact_phone: string
        address: string
        payment_terms: string
        lead_time_days: number
        notes: string
        is_active: number
    }>): Promise<Supplier | null> {
        const existing = await this.getById(id)
        if (!existing) return null

        const fields: string[] = []
        const values: (string | number | null)[] = []

        for (const [key, val] of Object.entries(data)) {
            if (val !== undefined) {
                fields.push(`${key} = ?`)
                values.push(val as string | number | null)
            }
        }

        if (fields.length === 0) return existing

        fields.push("updated_at = CURRENT_TIMESTAMP")
        values.push(id)

        await this.db.prepare(
            `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        return this.getById(id)
    }

    async deactivate(id: number): Promise<boolean> {
        const result = await this.update(id, { is_active: 0 })
        return result !== null
    }
}
