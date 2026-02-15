import type { Distributor } from '../db/types'

export class DistributorService {
    constructor(
        private db: D1Database,
        private kv: KVNamespace,
    ) {}

    /** List distributors with pagination */
    async list(limit = 50, offset = 0): Promise<{ distributors: Distributor[]; total: number }> {
        const [{ results }, countResult] = await Promise.all([
            this.db.prepare('SELECT id, name, balance, frozen_balance, tax_reg_number, role, created_at FROM distributors ORDER BY id DESC LIMIT ? OFFSET ?')
                .bind(limit, offset).all<Distributor>(),
            this.db.prepare('SELECT COUNT(*) as total FROM distributors').first<{ total: number }>(),
        ])

        return { distributors: results, total: countResult?.total || 0 }
    }

    /** Get distributor detail with aggregated stats */
    async getDetail(id: number): Promise<{
        distributor: Distributor
        orderCount: number
        commissionTotal: number
    } | null> {
        const distributor = await this.db.prepare(
            'SELECT id, name, balance, frozen_balance, tax_reg_number, role, created_at FROM distributors WHERE id = ?'
        ).bind(id).first<Distributor>()

        if (!distributor) return null

        const [orderStats, commStats] = await Promise.all([
            this.db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE distributor_id = ?')
                .bind(id).first<{ cnt: number }>(),
            this.db.prepare('SELECT COALESCE(SUM(commission_amount), 0) as total FROM commission_settlements WHERE distributor_id = ?')
                .bind(id).first<{ total: number }>(),
        ])

        return {
            distributor,
            orderCount: orderStats?.cnt || 0,
            commissionTotal: commStats?.total || 0,
        }
    }

    /** Create a new distributor with auto-generated token */
    async create(params: {
        name: string
        tax_reg_number?: string
        role?: 'admin' | 'distributor'
    }): Promise<Distributor> {
        const token = 'tok_' + this.generateHex(32)
        const role = params.role || 'distributor'

        const { meta } = await this.db.prepare(
            'INSERT INTO distributors (name, token, tax_reg_number, role) VALUES (?, ?, ?, ?)'
        ).bind(params.name, token, params.tax_reg_number || null, role).run()

        return {
            id: meta.last_row_id as number,
            name: params.name,
            token,
            username: null,
            password_hash: null,
            totp_secret: null,
            totp_enabled: 0,
            language: 'ja',
            balance: 0,
            frozen_balance: 0,
            tax_reg_number: params.tax_reg_number || null,
            email: null,
            phone: null,
            address: null,
            contact_person: null,
            role,
            created_at: new Date().toISOString(),
        }
    }

    /** Update distributor fields */
    async update(id: number, params: {
        name?: string
        tax_reg_number?: string
        role?: 'admin' | 'distributor'
    }): Promise<Distributor | null> {
        const fields: string[] = []
        const values: (string | null)[] = []

        if (params.name !== undefined) {
            fields.push('name = ?')
            values.push(params.name)
        }
        if (params.tax_reg_number !== undefined) {
            fields.push('tax_reg_number = ?')
            values.push(params.tax_reg_number)
        }
        if (params.role !== undefined) {
            fields.push('role = ?')
            values.push(params.role)
        }

        if (fields.length === 0) {
            return this.db.prepare(
                'SELECT id, name, balance, frozen_balance, tax_reg_number, role, created_at FROM distributors WHERE id = ?'
            ).bind(id).first<Distributor>()
        }

        values.push(String(id))
        await this.db.prepare(
            `UPDATE distributors SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        return this.db.prepare(
            'SELECT id, name, balance, frozen_balance, tax_reg_number, role, created_at FROM distributors WHERE id = ?'
        ).bind(id).first<Distributor>()
    }

    /** Reset distributor token and invalidate old KV session */
    async resetToken(id: number): Promise<{ token: string }> {
        // Get old token
        const old = await this.db.prepare('SELECT token FROM distributors WHERE id = ?')
            .bind(id).first<{ token: string | null }>()

        if (!old) throw new Error('Distributor not found')

        // Delete old KV session
        if (old.token) {
            await this.kv.delete(`session:${old.token}`)
        }

        // Generate new token
        const newToken = 'tok_' + this.generateHex(32)
        await this.db.prepare('UPDATE distributors SET token = ? WHERE id = ?')
            .bind(newToken, id).run()

        return { token: newToken }
    }

    /** Generate random hex string using crypto.getRandomValues */
    private generateHex(length: number): string {
        const bytes = new Uint8Array(length / 2)
        crypto.getRandomValues(bytes)
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    }
}
