import type { PriceRule, PriceHistory } from '../db/types'

const VALID_PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN', 'ALL'] as const

export class PricingService {
    constructor(private db: D1Database) {}

    async list(filters?: {
        sku?: string
        platform?: string
        isActive?: number
        limit?: number
        offset?: number
    }): Promise<{ rules: PriceRule[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.sku) {
            where += ' AND sku = ?'
            params.push(filters.sku)
        }
        if (filters?.platform) {
            where += ' AND platform = ?'
            params.push(filters.platform.toUpperCase())
        }
        if (filters?.isActive !== undefined) {
            where += ' AND is_active = ?'
            params.push(filters.isActive)
        }

        const countParams = [...params]

        const sql = `SELECT * FROM price_rules ${where} ORDER BY sku, platform LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM price_rules ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all<PriceRule>(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { rules: results, total: countResult?.total || 0 }
    }

    async getById(id: number): Promise<PriceRule | null> {
        return this.db.prepare('SELECT * FROM price_rules WHERE id = ?')
            .bind(id).first<PriceRule>()
    }

    async create(data: {
        sku: string
        platform: string
        base_price: number
        sale_price?: number
        valid_from?: string
        valid_to?: string
    }, changedBy?: number): Promise<PriceRule> {
        if (!data.sku?.trim()) throw new Error('SKU is required')
        if (!data.platform) throw new Error('Platform is required')

        const platform = data.platform.toUpperCase()
        if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
            throw new Error(`Invalid platform: ${data.platform}`)
        }
        if (data.base_price <= 0) throw new Error('Base price must be positive')

        const { meta } = await this.db.prepare(
            `INSERT INTO price_rules (sku, platform, base_price, sale_price, valid_from, valid_to)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            data.sku.trim(), platform, data.base_price,
            data.sale_price || null, data.valid_from || null, data.valid_to || null
        ).run()

        // Record price history
        await this.db.prepare(
            `INSERT INTO price_history (sku, platform, old_price, new_price, change_type, changed_by)
             VALUES (?, ?, NULL, ?, 'BASE', ?)`
        ).bind(data.sku.trim(), platform, data.base_price, changedBy || null).run()

        return this.db.prepare('SELECT * FROM price_rules WHERE id = ?')
            .bind(meta.last_row_id).first<PriceRule>() as Promise<PriceRule>
    }

    async update(id: number, data: Partial<{
        base_price: number
        sale_price: number | null
        valid_from: string | null
        valid_to: string | null
        is_active: number
    }>, changedBy?: number): Promise<PriceRule | null> {
        const existing = await this.getById(id)
        if (!existing) return null

        const fields: string[] = []
        const values: (string | number | null)[] = []

        if (data.base_price !== undefined && data.base_price !== existing.base_price) {
            fields.push('base_price = ?')
            values.push(data.base_price)
            // Record history
            await this.db.prepare(
                `INSERT INTO price_history (sku, platform, old_price, new_price, change_type, changed_by)
                 VALUES (?, ?, ?, ?, 'BASE', ?)`
            ).bind(existing.sku, existing.platform, existing.base_price, data.base_price, changedBy || null).run()
        }
        if (data.sale_price !== undefined) {
            fields.push('sale_price = ?')
            values.push(data.sale_price)
            if (data.sale_price !== existing.sale_price) {
                await this.db.prepare(
                    `INSERT INTO price_history (sku, platform, old_price, new_price, change_type, changed_by)
                     VALUES (?, ?, ?, ?, 'SALE', ?)`
                ).bind(existing.sku, existing.platform, existing.sale_price, data.sale_price, changedBy || null).run()
            }
        }
        if (data.valid_from !== undefined) {
            fields.push('valid_from = ?')
            values.push(data.valid_from)
        }
        if (data.valid_to !== undefined) {
            fields.push('valid_to = ?')
            values.push(data.valid_to)
        }
        if (data.is_active !== undefined) {
            fields.push('is_active = ?')
            values.push(data.is_active)
        }

        if (fields.length === 0) return existing

        fields.push('updated_at = CURRENT_TIMESTAMP')
        values.push(id)

        await this.db.prepare(
            `UPDATE price_rules SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        return this.getById(id)
    }

    async delete(id: number): Promise<boolean> {
        const existing = await this.getById(id)
        if (!existing) return false
        await this.db.prepare('DELETE FROM price_rules WHERE id = ?').bind(id).run()
        return true
    }

    async batchUpdate(updates: { sku: string; platform: string; base_price: number }[], changedBy?: number): Promise<{ updated: number; errors: string[] }> {
        let updated = 0
        const errors: string[] = []

        for (const u of updates) {
            try {
                const existing = await this.db.prepare(
                    'SELECT * FROM price_rules WHERE sku = ? AND platform = ? AND is_active = 1'
                ).bind(u.sku, u.platform.toUpperCase()).first<PriceRule>()

                if (existing) {
                    await this.update(existing.id, { base_price: u.base_price }, changedBy)
                } else {
                    await this.create({ sku: u.sku, platform: u.platform, base_price: u.base_price }, changedBy)
                }
                updated++
            } catch (e: any) {
                errors.push(`${u.sku}/${u.platform}: ${e.message}`)
            }
        }

        return { updated, errors }
    }

    async getHistory(filters?: {
        sku?: string
        platform?: string
        limit?: number
        offset?: number
    }): Promise<{ history: PriceHistory[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.sku) {
            where += ' AND sku = ?'
            params.push(filters.sku)
        }
        if (filters?.platform) {
            where += ' AND platform = ?'
            params.push(filters.platform.toUpperCase())
        }

        const countParams = [...params]

        const sql = `SELECT * FROM price_history ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM price_history ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all<PriceHistory>(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { history: results, total: countResult?.total || 0 }
    }

    async getMargins(filters?: { sku?: string; platform?: string }): Promise<any[]> {
        let where = 'WHERE pr.is_active = 1'
        const params: (string | number)[] = []

        if (filters?.sku) {
            where += ' AND pr.sku = ?'
            params.push(filters.sku)
        }
        if (filters?.platform) {
            where += ' AND pr.platform = ?'
            params.push(filters.platform.toUpperCase())
        }

        const sql = `
            SELECT pr.sku, pr.platform, pr.base_price, pr.sale_price,
                   p.cost_price,
                   COALESCE(pr.sale_price, pr.base_price) - p.cost_price as margin,
                   CASE WHEN p.cost_price > 0
                        THEN ROUND((COALESCE(pr.sale_price, pr.base_price) - p.cost_price) * 100.0 / COALESCE(pr.sale_price, pr.base_price), 1)
                        ELSE 0
                   END as margin_pct
            FROM price_rules pr
            LEFT JOIN products p ON p.sku = pr.sku
            ${where}
            ORDER BY pr.sku, pr.platform
        `

        const { results } = await this.db.prepare(sql).bind(...params).all()
        return results
    }
}
