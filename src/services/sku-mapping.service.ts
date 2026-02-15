/**
 * SkuMappingService - Enhanced platform SKU mapping management
 */
import type { PlatformMapping } from '../db/types'

const VALID_PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const

export class SkuMappingService {
    constructor(private db: D1Database) {}

    async list(filters?: { platform?: string; local_sku?: string; is_active?: number; limit?: number; offset?: number }): Promise<{ mappings: PlatformMapping[]; total: number }> {
        const limit = Math.min(Math.max(1, filters?.limit || 50), 200)
        const offset = Math.max(0, filters?.offset || 0)

        let where = '1=1'
        const binds: (string | number)[] = []

        if (filters?.platform) {
            where += ' AND pm.platform = ?'
            binds.push(filters.platform.toUpperCase())
        }
        if (filters?.local_sku) {
            where += ' AND pm.local_sku = ?'
            binds.push(filters.local_sku)
        }
        if (filters?.is_active !== undefined) {
            where += ' AND pm.is_active = ?'
            binds.push(filters.is_active)
        }

        const countBinds = [...binds]

        const sql = `SELECT pm.*, p.name_jp, p.name_cn FROM platform_mappings pm
                     LEFT JOIN products p ON p.sku = pm.local_sku
                     WHERE ${where}
                     ORDER BY pm.local_sku, pm.platform LIMIT ? OFFSET ?`
        binds.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM platform_mappings pm WHERE ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...binds).all<PlatformMapping>(),
            this.db.prepare(countSql).bind(...countBinds).first<{ total: number }>(),
        ])

        return { mappings: results, total: countResult?.total || 0 }
    }

    async getById(id: number): Promise<PlatformMapping | null> {
        return this.db.prepare(
            `SELECT pm.*, p.name_jp, p.name_cn FROM platform_mappings pm
             LEFT JOIN products p ON p.sku = pm.local_sku WHERE pm.id = ?`
        ).bind(id).first<PlatformMapping>()
    }

    async getByLocalSku(sku: string): Promise<PlatformMapping[]> {
        const { results } = await this.db.prepare(
            `SELECT pm.*, p.name_jp, p.name_cn FROM platform_mappings pm
             LEFT JOIN products p ON p.sku = pm.local_sku WHERE pm.local_sku = ?`
        ).bind(sku).all<PlatformMapping>()
        return results
    }

    async create(data: { local_sku: string; platform: string; platform_sku: string; price_sync?: number; stock_sync?: number; platform_title?: string; platform_description?: string }): Promise<PlatformMapping> {
        const platform = data.platform.toUpperCase()
        if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
            throw new Error(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`)
        }

        // Validate local_sku exists
        const product = await this.db.prepare('SELECT id FROM products WHERE sku = ?').bind(data.local_sku).first()
        if (!product) throw new Error(`Product not found: ${data.local_sku}`)

        const { meta } = await this.db.prepare(
            `INSERT INTO platform_mappings (local_sku, platform, platform_sku, price_sync, stock_sync, platform_title, platform_description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.local_sku, platform, data.platform_sku,
            data.price_sync || 0, data.stock_sync || 0,
            data.platform_title || null, data.platform_description || null
        ).run()

        return this.getById(meta.last_row_id) as Promise<PlatformMapping>
    }

    async update(id: number, data: { platform_sku?: string; price_sync?: number; stock_sync?: number; platform_title?: string; platform_description?: string; is_active?: number }): Promise<PlatformMapping | null> {
        const existing = await this.db.prepare('SELECT id FROM platform_mappings WHERE id = ?').bind(id).first()
        if (!existing) return null

        const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
        const binds: (string | number | null)[] = []

        if (data.platform_sku !== undefined) { fields.push('platform_sku = ?'); binds.push(data.platform_sku) }
        if (data.price_sync !== undefined) { fields.push('price_sync = ?'); binds.push(data.price_sync) }
        if (data.stock_sync !== undefined) { fields.push('stock_sync = ?'); binds.push(data.stock_sync) }
        if (data.platform_title !== undefined) { fields.push('platform_title = ?'); binds.push(data.platform_title) }
        if (data.platform_description !== undefined) { fields.push('platform_description = ?'); binds.push(data.platform_description) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); binds.push(data.is_active) }

        binds.push(id)
        await this.db.prepare(`UPDATE platform_mappings SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()

        return this.getById(id)
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.db.prepare('DELETE FROM platform_mappings WHERE id = ?').bind(id).run()
        return (result.meta?.changes || 0) > 0
    }

    async bulkImport(mappings: { local_sku: string; platform: string; platform_sku: string; price_sync?: number; stock_sync?: number }[]): Promise<{ imported: number; errors: { index: number; error: string }[] }> {
        let imported = 0
        const errors: { index: number; error: string }[] = []

        for (let i = 0; i < mappings.length; i++) {
            try {
                await this.create(mappings[i])
                imported++
            } catch (e: any) {
                errors.push({ index: i, error: e.message })
            }
        }

        return { imported, errors }
    }

    async exportAll(): Promise<PlatformMapping[]> {
        const { results } = await this.db.prepare(
            `SELECT pm.*, p.name_jp, p.name_cn FROM platform_mappings pm
             LEFT JOIN products p ON p.sku = pm.local_sku
             ORDER BY pm.local_sku, pm.platform`
        ).all<PlatformMapping>()
        return results
    }

    async validateMappings(): Promise<{ valid: number; invalid: { id: number; local_sku: string; platform: string; reason: string }[] }> {
        const { results: all } = await this.db.prepare('SELECT * FROM platform_mappings').all<PlatformMapping>()

        let valid = 0
        const invalid: { id: number; local_sku: string; platform: string; reason: string }[] = []

        for (const m of all) {
            const product = await this.db.prepare('SELECT id FROM products WHERE sku = ?').bind(m.local_sku).first()
            if (!product) {
                invalid.push({ id: m.id, local_sku: m.local_sku, platform: m.platform, reason: 'Product not found' })
            } else {
                valid++
            }
        }

        return { valid, invalid }
    }
}
