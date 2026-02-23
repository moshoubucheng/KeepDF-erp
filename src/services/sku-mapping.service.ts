/**
 * SkuMappingService - Enhanced platform SKU mapping management
 */
import type { PlatformMapping, Bindings } from '../db/types'

const VALID_PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const

export interface AiSkuSuggestion {
    local_sku: string
    platform: string
    platform_sku: string
    platform_title: string
    confidence: 'high' | 'medium' | 'low'
    reason: string
}

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

    /** AI-powered SKU suggestion for a single product (Plan A) */
    async aiSuggestForProduct(ai: Bindings['AI'], localSku: string): Promise<{ suggestions: AiSkuSuggestion[] }> {
        // 1. Validate product exists
        const product = await this.db.prepare(
            'SELECT sku, name_jp, name_cn, cost_price, tax_category FROM products WHERE sku = ?'
        ).bind(localSku).first<{ sku: string; name_jp: string | null; name_cn: string | null; cost_price: number; tax_category: string }>()
        if (!product) throw new Error(`Product not found: ${localSku}`)

        // 2. Get existing mappings for this product (to skip already-mapped platforms)
        const { results: existingMappings } = await this.db.prepare(
            'SELECT platform, platform_sku FROM platform_mappings WHERE local_sku = ? AND is_active = 1'
        ).bind(localSku).all<{ platform: string; platform_sku: string }>()
        const mappedPlatforms = new Set(existingMappings.map(m => m.platform))

        const missingPlatforms = VALID_PLATFORMS.filter(p => !mappedPlatforms.has(p))
        if (missingPlatforms.length === 0) {
            return { suggestions: [] }
        }

        // 3. Gather existing mapping patterns as examples
        const examples = await this.getExampleMappings()

        // 4. Call AI
        const suggestions = await this.callAiForSuggestions(ai, [product], missingPlatforms, examples)
        return { suggestions }
    }

    /** AI-powered bulk SKU mapping generation (Plan C) */
    async aiBulkSuggest(ai: Bindings['AI']): Promise<{ suggestions: AiSkuSuggestion[]; productsAnalyzed: number }> {
        // 1. Find all products that are missing at least one platform mapping
        const { results: products } = await this.db.prepare(`
            SELECT p.sku, p.name_jp, p.name_cn, p.cost_price, p.tax_category
            FROM products p
            ORDER BY p.sku
            LIMIT 50
        `).all<{ sku: string; name_jp: string | null; name_cn: string | null; cost_price: number; tax_category: string }>()

        if (products.length === 0) {
            return { suggestions: [], productsAnalyzed: 0 }
        }

        // 2. Get all existing mappings
        const { results: allMappings } = await this.db.prepare(
            'SELECT local_sku, platform, platform_sku FROM platform_mappings WHERE is_active = 1'
        ).all<{ local_sku: string; platform: string; platform_sku: string }>()

        const mappingMap = new Map<string, Set<string>>()
        for (const m of allMappings) {
            if (!mappingMap.has(m.local_sku)) mappingMap.set(m.local_sku, new Set())
            mappingMap.get(m.local_sku)!.add(m.platform)
        }

        // 3. Build list of products with their missing platforms
        const productsNeedingMappings: { product: typeof products[0]; missingPlatforms: string[] }[] = []
        for (const p of products) {
            const mapped = mappingMap.get(p.sku) || new Set()
            const missing = VALID_PLATFORMS.filter(plat => !mapped.has(plat))
            if (missing.length > 0) {
                productsNeedingMappings.push({ product: p, missingPlatforms: missing })
            }
        }

        if (productsNeedingMappings.length === 0) {
            return { suggestions: [], productsAnalyzed: products.length }
        }

        // 4. Gather existing mapping patterns
        const examples = await this.getExampleMappings()

        // 5. Process in batches of 10 to keep prompt size manageable
        const allSuggestions: AiSkuSuggestion[] = []
        const batchSize = 10
        for (let i = 0; i < productsNeedingMappings.length; i += batchSize) {
            const batch = productsNeedingMappings.slice(i, i + batchSize)
            const batchProducts = batch.map(b => b.product)
            // Collect all missing platforms across the batch
            const allMissing = [...new Set(batch.flatMap(b => b.missingPlatforms))]
            const suggestions = await this.callAiForSuggestions(ai, batchProducts, allMissing, examples, batch)
            allSuggestions.push(...suggestions)
        }

        return { suggestions: allSuggestions, productsAnalyzed: products.length }
    }

    /** Get example mappings for AI context (up to 20) */
    private async getExampleMappings(): Promise<{ local_sku: string; platform: string; platform_sku: string; name: string }[]> {
        const { results } = await this.db.prepare(`
            SELECT pm.local_sku, pm.platform, pm.platform_sku,
                   COALESCE(p.name_jp, p.name_cn, pm.local_sku) as name
            FROM platform_mappings pm
            LEFT JOIN products p ON p.sku = pm.local_sku
            WHERE pm.is_active = 1
            ORDER BY pm.local_sku, pm.platform
            LIMIT 20
        `).all<{ local_sku: string; platform: string; platform_sku: string; name: string }>()
        return results
    }

    /** Call Workers AI to generate SKU suggestions */
    private async callAiForSuggestions(
        ai: Bindings['AI'],
        products: { sku: string; name_jp: string | null; name_cn: string | null; cost_price: number; tax_category: string }[],
        platforms: string[],
        examples: { local_sku: string; platform: string; platform_sku: string; name: string }[],
        perProductPlatforms?: { product: { sku: string }; missingPlatforms: string[] }[],
    ): Promise<AiSkuSuggestion[]> {
        // Build examples text
        const examplesText = examples.length > 0
            ? examples.map(e => `  ${e.local_sku}「${e.name}」→ ${e.platform}: ${e.platform_sku}`).join('\n')
            : '  (まだマッピングがありません。各プラットフォームの一般的な命名規則に従ってください)'

        // Build product list with per-product missing platforms
        const productLines = products.map(p => {
            const name = p.name_jp || p.name_cn || p.sku
            const perProduct = perProductPlatforms?.find(pp => pp.product.sku === p.sku)
            const missing = perProduct ? perProduct.missingPlatforms : platforms
            return `  - SKU: ${p.sku}, 名前: ${name}, 原価: ¥${p.cost_price}, 税区分: ${p.tax_category} → 必要なプラットフォーム: ${missing.join(', ')}`
        }).join('\n')

        const messages: { role: 'system' | 'user'; content: string }[] = [
            {
                role: 'system',
                content: `あなたはECプラットフォームのSKUマッピング専門家です。ローカルSKUから各プラットフォーム（TikTok, Temu, Rakuten）用のSKUを生成します。

ルール:
1. 既存のマッピングパターンを分析し、同じ命名規則に従うこと
2. 既存パターンがない場合のデフォルト規則:
   - TikTok: TT-{カテゴリ略称}-{商品名略称} (例: TT-ELEC-WIDGET01)
   - Temu: TEMU-{数字ID} (例: TEMU-100001)
   - Rakuten: RK-{カテゴリ略称}-{商品名略称} (例: RK-ELEC-WIDGET01)
3. SKUは英数字とハイフンのみ使用（スペースや日本語不可）
4. 各SKUは一意であること（既存のplatform_skuと重複しないこと）
5. platform_titleは日本語の短い商品名（20文字以内）

出力形式（JSON配列、マークダウン不要、コードフェンス不要）:
[{"local_sku": "...", "platform": "TIKTOK", "platform_sku": "...", "platform_title": "...", "confidence": "high"|"medium"|"low", "reason": "理由（30文字以内）"}]`,
            },
            {
                role: 'user',
                content: `既存のマッピングパターン:
${examplesText}

マッピングが必要な商品:
${productLines}

上記の商品について、指定されたプラットフォームのSKUを生成してください。`,
            },
        ]

        const aiResponse = await ai.run(
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            { messages, max_tokens: products.length > 1 ? 2048 : 1024, temperature: 0.2 },
        )

        // Parse AI response
        const raw = aiResponse as Record<string, unknown>
        let responseContent: unknown = null
        if (typeof aiResponse === 'string') {
            responseContent = aiResponse
        } else if (raw && typeof raw === 'object' && 'response' in raw) {
            responseContent = raw.response
        }

        let suggestions: AiSkuSuggestion[] = []
        try {
            let parsed: unknown = responseContent
            if (typeof responseContent === 'string') {
                const cleaned = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
                parsed = JSON.parse(cleaned)
            }
            if (Array.isArray(parsed)) {
                suggestions = parsed as AiSkuSuggestion[]
            } else if (parsed && typeof parsed === 'object') {
                // LLM may wrap array in an object like { suggestions: [...] } or { data: [...] }
                const obj = parsed as Record<string, unknown>
                const arr = obj.suggestions || obj.data || obj.results || Object.values(obj).find(v => Array.isArray(v))
                if (Array.isArray(arr)) {
                    suggestions = arr as AiSkuSuggestion[]
                }
            }
        } catch {
            return []
        }

        if (!Array.isArray(suggestions)) return []

        // Get all existing platform_skus to filter out duplicates
        const { results: existingSkus } = await this.db.prepare(
            'SELECT platform, platform_sku FROM platform_mappings'
        ).all<{ platform: string; platform_sku: string }>()
        const existingSet = new Set(existingSkus.map(e => `${e.platform}:${e.platform_sku}`))

        // Validate and normalize suggestions
        const validSkus = new Set(products.map(p => p.sku))
        return suggestions.filter(s =>
            s.local_sku && validSkus.has(s.local_sku) &&
            s.platform && VALID_PLATFORMS.includes(s.platform as typeof VALID_PLATFORMS[number]) &&
            s.platform_sku && typeof s.platform_sku === 'string' &&
            /^[A-Za-z0-9\-_]+$/.test(s.platform_sku) &&
            !existingSet.has(`${s.platform.toUpperCase()}:${s.platform_sku}`)
        ).map(s => ({
            local_sku: s.local_sku,
            platform: s.platform.toUpperCase(),
            platform_sku: s.platform_sku,
            platform_title: s.platform_title || '',
            confidence: (['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'medium') as 'high' | 'medium' | 'low',
            reason: s.reason || '',
        }))
    }
}
