import type {
    AutomationRule,
    AutomationLog,
    AutoReorderConditions,
    AutoReorderActions,
    AutoPriceAdjustConditions,
    AutoPriceAdjustActions,
    StockAlertConditions,
    StockAlertActions,
} from '../db/types'
import { ForecastingService } from './forecasting.service'
import { PricingService } from './pricing.service'
import { NotificationCenterService } from './notification-center.service'

const VALID_TYPES = ['AUTO_REORDER', 'AUTO_PRICE_ADJUST', 'STOCK_ALERT'] as const

export class AutomationService {
    constructor(private db: D1Database) {}

    // ===== CRUD =====

    async list(distributorId: number, role: string): Promise<AutomationRule[]> {
        let sql = 'SELECT * FROM automation_rules'
        const params: (string | number)[] = []

        if (role !== 'admin') {
            sql += ' WHERE distributor_id = ?'
            params.push(distributorId)
        }

        sql += ' ORDER BY created_at DESC'

        const { results } = await this.db.prepare(sql).bind(...params).all<AutomationRule>()
        return results
    }

    async getById(id: number, distributorId?: number): Promise<AutomationRule | null> {
        if (distributorId) {
            return this.db.prepare('SELECT * FROM automation_rules WHERE id = ? AND distributor_id = ?')
                .bind(id, distributorId).first<AutomationRule>()
        }
        return this.db.prepare('SELECT * FROM automation_rules WHERE id = ?')
            .bind(id).first<AutomationRule>()
    }

    async create(data: {
        name: string
        type: string
        conditions: Record<string, unknown>
        actions: Record<string, unknown>
        distributorId: number
    }): Promise<AutomationRule> {
        if (!data.name?.trim()) throw new Error('Name is required')
        if (!VALID_TYPES.includes(data.type as typeof VALID_TYPES[number])) {
            throw new Error(`Invalid type: ${data.type}. Must be one of: ${VALID_TYPES.join(', ')}`)
        }

        const { meta } = await this.db.prepare(
            `INSERT INTO automation_rules (name, type, conditions, actions, distributor_id)
             VALUES (?, ?, ?, ?, ?)`
        ).bind(
            data.name.trim(),
            data.type,
            JSON.stringify(data.conditions),
            JSON.stringify(data.actions),
            data.distributorId,
        ).run()

        return this.db.prepare('SELECT * FROM automation_rules WHERE id = ?')
            .bind(meta.last_row_id).first<AutomationRule>() as Promise<AutomationRule>
    }

    async update(id: number, data: Partial<{
        name: string
        conditions: Record<string, unknown>
        actions: Record<string, unknown>
        is_active: number
    }>): Promise<AutomationRule | null> {
        const existing = await this.getById(id)
        if (!existing) return null

        const fields: string[] = []
        const values: (string | number | null)[] = []

        if (data.name !== undefined) {
            if (!data.name?.trim()) throw new Error('Name is required')
            fields.push('name = ?')
            values.push(data.name.trim())
        }
        if (data.conditions !== undefined) {
            fields.push('conditions = ?')
            values.push(JSON.stringify(data.conditions))
        }
        if (data.actions !== undefined) {
            fields.push('actions = ?')
            values.push(JSON.stringify(data.actions))
        }
        if (data.is_active !== undefined) {
            fields.push('is_active = ?')
            values.push(data.is_active)
        }

        if (fields.length === 0) return existing

        fields.push('updated_at = CURRENT_TIMESTAMP')
        values.push(id)

        await this.db.prepare(
            `UPDATE automation_rules SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        return this.getById(id)
    }

    async delete(id: number): Promise<boolean> {
        const existing = await this.getById(id)
        if (!existing) return false
        await this.db.prepare('DELETE FROM automation_rules WHERE id = ?').bind(id).run()
        return true
    }

    // ===== Logs =====

    async getLogs(filters?: {
        ruleId?: number
        status?: string
        limit?: number
        offset?: number
    }): Promise<{ logs: AutomationLog[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.ruleId) {
            where += ' AND rule_id = ?'
            params.push(filters.ruleId)
        }
        if (filters?.status) {
            where += ' AND status = ?'
            params.push(filters.status)
        }

        const countParams = [...params]
        const countSql = `SELECT COUNT(*) as total FROM automation_logs ${where}`
        const countResult = await this.db.prepare(countSql).bind(...countParams).first<{ total: number }>()

        const sql = `SELECT * FROM automation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const { results } = await this.db.prepare(sql).bind(...params).all<AutomationLog>()
        return { logs: results, total: countResult?.total || 0 }
    }

    // ===== Rule Engine =====

    async evaluateAllRules(triggerType: 'CRON' | 'EVENT' | 'MANUAL'): Promise<{
        evaluated: number
        executed: number
        skipped: number
        errors: number
    }> {
        const { results: rules } = await this.db.prepare(
            'SELECT * FROM automation_rules WHERE is_active = 1'
        ).all<AutomationRule>()

        let evaluated = 0
        let executed = 0
        let skipped = 0
        let errors = 0

        for (const rule of rules) {
            evaluated++
            try {
                const log = await this.evaluateRule(rule.id, triggerType)
                if (log.status === 'SUCCESS') executed++
                else if (log.status === 'SKIPPED' || log.status === 'NO_MATCH') skipped++
                else errors++
            } catch {
                errors++
            }
        }

        return { evaluated, executed, skipped, errors }
    }

    async evaluateRule(ruleId: number, triggerType: 'CRON' | 'EVENT' | 'MANUAL'): Promise<AutomationLog> {
        const rule = await this.getById(ruleId)
        if (!rule) throw new Error('Rule not found')

        if (!rule.is_active) {
            return this.createLog(rule, triggerType, 'SKIPPED', 'Rule is inactive', 0, 0)
        }

        const startTime = Date.now()

        try {
            let result: { status: 'SUCCESS' | 'NO_MATCH'; details: string; itemsAffected: number }

            switch (rule.type) {
                case 'AUTO_REORDER':
                    result = await this.executeAutoReorder(rule)
                    break
                case 'AUTO_PRICE_ADJUST':
                    result = await this.executeAutoPriceAdjust(rule)
                    break
                case 'STOCK_ALERT':
                    result = await this.executeStockAlert(rule)
                    break
                default:
                    result = { status: 'NO_MATCH', details: `Unknown rule type: ${rule.type}`, itemsAffected: 0 }
            }

            const elapsed = Date.now() - startTime

            // Update rule run stats
            await this.db.prepare(
                'UPDATE automation_rules SET last_run_at = CURRENT_TIMESTAMP, run_count = run_count + 1 WHERE id = ?'
            ).bind(ruleId).run()

            return this.createLog(rule, triggerType, result.status, result.details, result.itemsAffected, elapsed)
        } catch (e: any) {
            const elapsed = Date.now() - startTime
            return this.createLog(rule, triggerType, 'FAILED', e.message, 0, elapsed)
        }
    }

    // ===== Rule Executors =====

    private async executeAutoReorder(rule: AutomationRule): Promise<{
        status: 'SUCCESS' | 'NO_MATCH'
        details: string
        itemsAffected: number
    }> {
        const conditions: AutoReorderConditions = JSON.parse(rule.conditions)
        const actions: AutoReorderActions = JSON.parse(rule.actions)

        const forecastService = new ForecastingService(this.db)
        let suggestions = await forecastService.getReorderSuggestions()

        if (suggestions.length === 0) {
            return { status: 'NO_MATCH', details: 'No items below reorder point', itemsAffected: 0 }
        }

        // Apply conditions filters
        if (conditions.sku_filter && conditions.sku_filter.length > 0) {
            suggestions = suggestions.filter(s => conditions.sku_filter!.includes(s.sku))
        }
        if (conditions.min_daily_velocity && conditions.min_daily_velocity > 0) {
            suggestions = suggestions.filter(s => (s.daily_velocity || 0) >= conditions.min_daily_velocity!)
        }
        if (conditions.threshold_type === 'fixed' && conditions.threshold_value) {
            suggestions = suggestions.filter(s => (s.current_stock || 0) <= conditions.threshold_value!)
        }

        if (suggestions.length === 0) {
            return { status: 'NO_MATCH', details: 'No items match conditions after filtering', itemsAffected: 0 }
        }

        // Build PO items
        const multiplier = actions.qty_multiplier || 1
        const items = suggestions.map(s => ({
            sku: s.sku,
            qty: Math.max(1, Math.ceil((s.suggested_qty || 1) * multiplier)),
            unit_cost: s.cost_price || 0,
        }))

        // Find supplier: use action-specified or first active supplier
        let supplierId = actions.supplier_id
        if (!supplierId) {
            const supplier = await this.db.prepare(
                'SELECT id FROM suppliers WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
            ).first<{ id: number }>()
            if (!supplier) {
                return { status: 'NO_MATCH', details: 'No active supplier found', itemsAffected: 0 }
            }
            supplierId = supplier.id
        }

        // Generate PO number
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const count = await this.db.prepare(
            `SELECT COUNT(*) as cnt FROM purchase_orders WHERE po_number LIKE ?`
        ).bind(`PO-${dateStr}-%`).first<{ cnt: number }>()
        const seq = String((count?.cnt || 0) + 1).padStart(3, '0')
        const poNumber = `PO-${dateStr}-${seq}`

        // Calculate total
        const totalAmount = items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0)

        // Create DRAFT PO
        const { meta } = await this.db.prepare(
            `INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, notes, created_by)
             VALUES (?, ?, 'DRAFT', ?, ?, ?)`
        ).bind(poNumber, supplierId, totalAmount, `Auto-generated by rule: ${rule.name}`, rule.distributor_id).run()

        const poId = meta.last_row_id

        // Insert PO items
        const stmts = items.map(item =>
            this.db.prepare(
                'INSERT INTO purchase_order_items (po_id, sku, qty, unit_cost) VALUES (?, ?, ?, ?)'
            ).bind(poId, item.sku, item.qty, item.unit_cost)
        )
        if (stmts.length > 0) {
            for (let i = 0; i < stmts.length; i += 20) {
                await this.db.batch(stmts.slice(i, i + 20))
            }
        }

        // Notification (best-effort)
        if (actions.notify !== false) {
            try {
                const nc = new NotificationCenterService(this.db)
                await nc.create({
                    distributorId: rule.distributor_id,
                    type: 'SYSTEM_ALERT',
                    title: '自動発注',
                    message: `ルール「${rule.name}」により発注書 ${poNumber} を作成しました（${items.length}品目）`,
                    relatedResourceType: 'purchase_order',
                    relatedResourceId: String(poId),
                })
            } catch (e) {
                console.error('[AUTOMATION] Notification failed:', e)
            }
        }

        return {
            status: 'SUCCESS',
            details: `Created DRAFT PO ${poNumber} with ${items.length} items, total=${totalAmount}`,
            itemsAffected: items.length,
        }
    }

    private async executeAutoPriceAdjust(rule: AutomationRule): Promise<{
        status: 'SUCCESS' | 'NO_MATCH'
        details: string
        itemsAffected: number
    }> {
        const conditions: AutoPriceAdjustConditions = JSON.parse(rule.conditions)
        const actions: AutoPriceAdjustActions = JSON.parse(rule.actions)

        const pricingService = new PricingService(this.db)
        let margins = await pricingService.getMargins()

        if (margins.length === 0) {
            return { status: 'NO_MATCH', details: 'No price rules found', itemsAffected: 0 }
        }

        // Apply filters
        if (conditions.sku_filter && conditions.sku_filter.length > 0) {
            margins = margins.filter(m => conditions.sku_filter!.includes(m.sku))
        }
        if (conditions.platform_filter && conditions.platform_filter.length > 0) {
            margins = margins.filter(m => conditions.platform_filter!.includes(m.platform))
        }

        // Filter by margin threshold
        let lowMargin: typeof margins
        if (conditions.margin_type === 'min_margin_pct') {
            lowMargin = margins.filter(m => (m.margin_percent || 0) < conditions.threshold)
        } else {
            lowMargin = margins.filter(m => (m.margin || 0) < conditions.threshold)
        }

        if (lowMargin.length === 0) {
            return { status: 'NO_MATCH', details: 'No items below margin threshold', itemsAffected: 0 }
        }

        let updated = 0
        for (const item of lowMargin) {
            // Find the price rule
            const priceRule = await this.db.prepare(
                'SELECT * FROM price_rules WHERE sku = ? AND platform = ? AND is_active = 1'
            ).bind(item.sku, item.platform).first<{ id: number; base_price: number }>()

            if (!priceRule) continue

            let newPrice: number
            if (actions.adjust_type === 'set_margin_pct') {
                // Set price to achieve target margin: price = cost / (1 - margin_pct/100)
                const costPrice = item.cost_price || 0
                if (costPrice <= 0) continue
                if (actions.adjust_value >= 100) continue // margin >= 100% is invalid (division by zero)
                newPrice = Math.ceil(costPrice / (1 - actions.adjust_value / 100))
            } else if (actions.adjust_type === 'increase_pct') {
                newPrice = Math.ceil(priceRule.base_price * (1 + actions.adjust_value / 100))
            } else {
                // increase_abs
                newPrice = priceRule.base_price + actions.adjust_value
            }

            // Respect max_price
            if (actions.max_price && newPrice > actions.max_price) {
                newPrice = actions.max_price
            }

            await pricingService.update(priceRule.id, { base_price: newPrice })
            updated++
        }

        // Notification
        if (actions.notify && updated > 0) {
            try {
                const nc = new NotificationCenterService(this.db)
                await nc.create({
                    distributorId: rule.distributor_id,
                    type: 'SYSTEM_ALERT',
                    title: '価格自動調整',
                    message: `ルール「${rule.name}」により${updated}件の価格を調整しました`,
                })
            } catch (e) {
                console.error('[AUTOMATION] Notification failed:', e)
            }
        }

        return {
            status: updated > 0 ? 'SUCCESS' : 'NO_MATCH',
            details: `Adjusted ${updated} prices`,
            itemsAffected: updated,
        }
    }

    private async executeStockAlert(rule: AutomationRule): Promise<{
        status: 'SUCCESS' | 'NO_MATCH'
        details: string
        itemsAffected: number
    }> {
        const conditions: StockAlertConditions = JSON.parse(rule.conditions)
        const actions: StockAlertActions = JSON.parse(rule.actions)

        let alertItems: { sku: string; value: number }[] = []

        if (conditions.threshold_type === 'days_of_stock') {
            const { results } = await this.db.prepare(
                'SELECT sku, days_of_stock FROM inventory_forecasts WHERE days_of_stock <= ?'
            ).bind(conditions.threshold_value).all<{ sku: string; days_of_stock: number }>()

            alertItems = results.map(r => ({ sku: r.sku, value: r.days_of_stock }))
        } else {
            // fixed_qty
            const { results } = await this.db.prepare(
                'SELECT sku, qty FROM warehouse_locations WHERE qty <= ?'
            ).bind(conditions.threshold_value).all<{ sku: string; qty: number }>()

            alertItems = results.map(r => ({ sku: r.sku, value: r.qty }))
        }

        // Apply SKU filter
        if (conditions.sku_filter && conditions.sku_filter.length > 0) {
            alertItems = alertItems.filter(item => conditions.sku_filter!.includes(item.sku))
        }

        if (alertItems.length === 0) {
            return { status: 'NO_MATCH', details: 'No items below threshold', itemsAffected: 0 }
        }

        // Send notification
        if (actions.notify) {
            try {
                const nc = new NotificationCenterService(this.db)
                const level = actions.notification_level || 'WARNING'
                const skuList = alertItems.slice(0, 10).map(i => `${i.sku}(${i.value})`).join(', ')
                await nc.create({
                    distributorId: rule.distributor_id,
                    type: 'LOW_STOCK',
                    title: '在庫アラート',
                    message: `ルール「${rule.name}」: ${alertItems.length}品目が閾値以下です。${skuList}${alertItems.length > 10 ? '...' : ''}`,
                })
            } catch (e) {
                console.error('[AUTOMATION] Notification failed:', e)
            }
        }

        return {
            status: 'SUCCESS',
            details: `${alertItems.length} items below threshold`,
            itemsAffected: alertItems.length,
        }
    }

    // ===== Helpers =====

    private async createLog(
        rule: AutomationRule,
        triggerType: 'CRON' | 'EVENT' | 'MANUAL',
        status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'NO_MATCH',
        details: string,
        itemsAffected: number,
        executionTimeMs: number,
    ): Promise<AutomationLog> {
        const { meta } = await this.db.prepare(
            `INSERT INTO automation_logs (rule_id, rule_name, trigger_type, status, details, items_affected, execution_time_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(rule.id, rule.name, triggerType, status, details, itemsAffected, executionTimeMs).run()

        return this.db.prepare('SELECT * FROM automation_logs WHERE id = ?')
            .bind(meta.last_row_id).first<AutomationLog>() as Promise<AutomationLog>
    }
}
