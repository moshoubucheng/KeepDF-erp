import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { AutomationService } from '../services/automation.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'automation_logs', 'automation_rules',
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
    'purchase_order_items', 'purchase_orders', 'suppliers',
    'price_rules', 'price_history',
    'message_templates', 'customer_messages', 'message_triggers',
    'inventory_forecasts',
]

async function setupDB(db: D1Database) {
    for (const table of TABLE_NAMES) {
        await db.prepare(`DROP TABLE IF EXISTS ${table}`).run()
    }
    for (const stmt of schemaSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
    for (const stmt of seedSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Automation Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    // ===== CRUD =====

    it('create() creates a rule', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Low stock auto reorder',
            type: 'AUTO_REORDER',
            conditions: { threshold_type: 'reorder_point' },
            actions: { qty_multiplier: 1.5, notify: true },
            distributorId: 1,
        })

        expect(rule.id).toBeTruthy()
        expect(rule.name).toBe('Low stock auto reorder')
        expect(rule.type).toBe('AUTO_REORDER')
        expect(rule.is_active).toBe(1)
        expect(rule.run_count).toBe(0)
    })

    it('create() rejects invalid type', async () => {
        const service = new AutomationService(env.DB)
        await expect(service.create({
            name: 'Bad rule',
            type: 'INVALID',
            conditions: {},
            actions: {},
            distributorId: 1,
        })).rejects.toThrow('Invalid type')
    })

    it('create() rejects empty name', async () => {
        const service = new AutomationService(env.DB)
        await expect(service.create({
            name: '',
            type: 'STOCK_ALERT',
            conditions: {},
            actions: {},
            distributorId: 1,
        })).rejects.toThrow('Name is required')
    })

    it('list() returns rules for admin', async () => {
        const service = new AutomationService(env.DB)
        await service.create({ name: 'Rule1', type: 'AUTO_REORDER', conditions: {}, actions: {}, distributorId: 1 })
        await service.create({ name: 'Rule2', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 2 })

        const rules = await service.list(1, 'admin')
        expect(rules.length).toBe(2) // admin sees all
    })

    it('list() filters by distributor for non-admin', async () => {
        const service = new AutomationService(env.DB)
        await service.create({ name: 'Rule1', type: 'AUTO_REORDER', conditions: {}, actions: {}, distributorId: 1 })
        await service.create({ name: 'Rule2', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 2 })

        const rules = await service.list(2, 'distributor')
        expect(rules.length).toBe(1)
        expect(rules[0].name).toBe('Rule2')
    })

    it('getById() returns a rule', async () => {
        const service = new AutomationService(env.DB)
        const created = await service.create({ name: 'Test', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 1 })
        const rule = await service.getById(created.id)
        expect(rule).toBeTruthy()
        expect(rule!.name).toBe('Test')
    })

    it('update() updates a rule', async () => {
        const service = new AutomationService(env.DB)
        const created = await service.create({ name: 'Old', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 1 })
        const updated = await service.update(created.id, { name: 'New', is_active: 0 })
        expect(updated!.name).toBe('New')
        expect(updated!.is_active).toBe(0)
    })

    it('delete() removes a rule', async () => {
        const service = new AutomationService(env.DB)
        const created = await service.create({ name: 'ToDelete', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 1 })
        const deleted = await service.delete(created.id)
        expect(deleted).toBe(true)
        const check = await service.getById(created.id)
        expect(check).toBeNull()
    })

    // ===== AUTO_REORDER =====

    it('AUTO_REORDER creates DRAFT PO when items below reorder point', async () => {
        // Set up forecast data showing low stock
        await env.DB.prepare(
            `INSERT INTO inventory_forecasts (sku, daily_velocity, weekly_velocity, days_of_stock, reorder_point, safety_stock, lead_time_days)
             VALUES ('CARROT-500ML', 5.0, 35.0, 3.0, 50, 15, 7)`
        ).run()
        // Set warehouse stock below reorder point
        await env.DB.prepare("UPDATE warehouse_locations SET qty = 10 WHERE sku = 'CARROT-500ML'").run()
        // Add a supplier
        await env.DB.prepare("INSERT INTO suppliers (name, lead_time_days, is_active) VALUES ('Test Supplier', 7, 1)").run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Auto Reorder Test',
            type: 'AUTO_REORDER',
            conditions: { threshold_type: 'reorder_point', min_daily_velocity: 1.0 },
            actions: { qty_multiplier: 1, notify: true },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('SUCCESS')
        expect(log.items_affected).toBeGreaterThan(0)

        // Verify PO was created as DRAFT
        const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE status = 'DRAFT' ORDER BY id DESC LIMIT 1").first()
        expect(po).toBeTruthy()
        expect((po as any).notes).toContain('Auto Reorder Test')
    })

    it('AUTO_REORDER applies sku_filter', async () => {
        await env.DB.prepare(
            `INSERT INTO inventory_forecasts (sku, daily_velocity, weekly_velocity, days_of_stock, reorder_point, safety_stock, lead_time_days)
             VALUES ('CARROT-500ML', 5.0, 35.0, 3.0, 50, 15, 7)`
        ).run()
        await env.DB.prepare("UPDATE warehouse_locations SET qty = 10 WHERE sku = 'CARROT-500ML'").run()
        await env.DB.prepare("INSERT INTO suppliers (name, lead_time_days, is_active) VALUES ('Sup', 7, 1)").run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Filter test',
            type: 'AUTO_REORDER',
            conditions: { threshold_type: 'reorder_point', sku_filter: ['NONEXISTENT-SKU'] },
            actions: { qty_multiplier: 1 },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('NO_MATCH')
    })

    it('AUTO_REORDER returns NO_MATCH when no low stock', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'No match test',
            type: 'AUTO_REORDER',
            conditions: { threshold_type: 'reorder_point' },
            actions: {},
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('NO_MATCH')
    })

    it('AUTO_REORDER updates run_count after execution', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Count test',
            type: 'AUTO_REORDER',
            conditions: { threshold_type: 'reorder_point' },
            actions: {},
            distributorId: 1,
        })

        await service.evaluateRule(rule.id, 'MANUAL')
        const updated = await service.getById(rule.id)
        expect(updated!.run_count).toBe(1)
        expect(updated!.last_run_at).toBeTruthy()
    })

    it('AUTO_REORDER creates notification', async () => {
        await env.DB.prepare(
            `INSERT INTO inventory_forecasts (sku, daily_velocity, weekly_velocity, days_of_stock, reorder_point, safety_stock, lead_time_days)
             VALUES ('CARROT-500ML', 5.0, 35.0, 3.0, 50, 15, 7)`
        ).run()
        await env.DB.prepare("UPDATE warehouse_locations SET qty = 10 WHERE sku = 'CARROT-500ML'").run()
        await env.DB.prepare("INSERT INTO suppliers (name, lead_time_days, is_active) VALUES ('Sup', 7, 1)").run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Notify test',
            type: 'AUTO_REORDER',
            conditions: { threshold_type: 'reorder_point' },
            actions: { notify: true },
            distributorId: 1,
        })

        await service.evaluateRule(rule.id, 'MANUAL')

        const notif = await env.DB.prepare(
            "SELECT * FROM notifications WHERE type = 'SYSTEM_ALERT' AND distributor_id = 1 ORDER BY id DESC LIMIT 1"
        ).first()
        expect(notif).toBeTruthy()
        expect((notif as any).title).toBe('自動発注')
    })

    // ===== AUTO_PRICE_ADJUST =====

    it('AUTO_PRICE_ADJUST adjusts price when margin is low', async () => {
        // Create price rule with low margin
        await env.DB.prepare(
            "INSERT INTO price_rules (sku, platform, base_price, is_active) VALUES ('CARROT-500ML', 'TIKTOK', 1300, 1)"
        ).run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Price adjust test',
            type: 'AUTO_PRICE_ADJUST',
            conditions: { margin_type: 'min_margin_pct', threshold: 20 },
            actions: { adjust_type: 'set_margin_pct', adjust_value: 25, notify: true },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        // Price rule margin: (1300-1200)/1300 = 7.7% < 20% threshold
        expect(log.status).toBe('SUCCESS')
        expect(log.items_affected).toBeGreaterThan(0)

        // Check new price was set
        const updated = await env.DB.prepare(
            "SELECT base_price FROM price_rules WHERE sku = 'CARROT-500ML' AND platform = 'TIKTOK'"
        ).first<{ base_price: number }>()
        expect(updated!.base_price).toBeGreaterThan(1300)
    })

    it('AUTO_PRICE_ADJUST respects max_price', async () => {
        await env.DB.prepare(
            "INSERT INTO price_rules (sku, platform, base_price, is_active) VALUES ('CARROT-500ML', 'TIKTOK', 1300, 1)"
        ).run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Max price test',
            type: 'AUTO_PRICE_ADJUST',
            conditions: { margin_type: 'min_margin_pct', threshold: 20 },
            actions: { adjust_type: 'set_margin_pct', adjust_value: 50, max_price: 1500 },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('SUCCESS')

        const updated = await env.DB.prepare(
            "SELECT base_price FROM price_rules WHERE sku = 'CARROT-500ML' AND platform = 'TIKTOK'"
        ).first<{ base_price: number }>()
        expect(updated!.base_price).toBeLessThanOrEqual(1500)
    })

    it('AUTO_PRICE_ADJUST NO_MATCH when all margins OK', async () => {
        // Price rule with good margin
        await env.DB.prepare(
            "INSERT INTO price_rules (sku, platform, base_price, is_active) VALUES ('CARROT-500ML', 'TIKTOK', 5000, 1)"
        ).run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'No match test',
            type: 'AUTO_PRICE_ADJUST',
            conditions: { margin_type: 'min_margin_pct', threshold: 20 },
            actions: { adjust_type: 'increase_pct', adjust_value: 10 },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('NO_MATCH')
    })

    // ===== STOCK_ALERT =====

    it('STOCK_ALERT sends alert for days_of_stock', async () => {
        await env.DB.prepare(
            `INSERT INTO inventory_forecasts (sku, daily_velocity, weekly_velocity, days_of_stock, reorder_point, safety_stock, lead_time_days)
             VALUES ('CARROT-500ML', 5.0, 35.0, 3.0, 50, 15, 7)`
        ).run()

        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Stock alert test',
            type: 'STOCK_ALERT',
            conditions: { threshold_type: 'days_of_stock', threshold_value: 7 },
            actions: { notify: true, notification_level: 'WARNING' },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('SUCCESS')
        expect(log.items_affected).toBeGreaterThan(0)

        // Check notification was created
        const notif = await env.DB.prepare(
            "SELECT * FROM notifications WHERE type = 'LOW_STOCK' AND distributor_id = 1 ORDER BY id DESC LIMIT 1"
        ).first()
        expect(notif).toBeTruthy()
    })

    it('STOCK_ALERT for fixed_qty threshold', async () => {
        // MATCHA-100G has qty=150
        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'Fixed qty alert',
            type: 'STOCK_ALERT',
            conditions: { threshold_type: 'fixed_qty', threshold_value: 200 },
            actions: { notify: true },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('SUCCESS')
        expect(log.items_affected).toBeGreaterThan(0)
    })

    it('STOCK_ALERT NO_MATCH when all stock OK', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({
            name: 'No alert test',
            type: 'STOCK_ALERT',
            conditions: { threshold_type: 'fixed_qty', threshold_value: 1 },
            actions: { notify: true },
            distributorId: 1,
        })

        const log = await service.evaluateRule(rule.id, 'MANUAL')
        expect(log.status).toBe('NO_MATCH')
    })

    // ===== evaluateAll =====

    it('evaluateAllRules() processes all active rules', async () => {
        const service = new AutomationService(env.DB)
        await service.create({ name: 'Rule1', type: 'STOCK_ALERT', conditions: { threshold_type: 'fixed_qty', threshold_value: 1 }, actions: { notify: true }, distributorId: 1 })
        await service.create({ name: 'Rule2', type: 'STOCK_ALERT', conditions: { threshold_type: 'fixed_qty', threshold_value: 1 }, actions: { notify: true }, distributorId: 1 })

        const result = await service.evaluateAllRules('MANUAL')
        expect(result.evaluated).toBe(2)
    })

    it('evaluateAllRules() skips inactive rules', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({ name: 'Inactive', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 1 })
        await service.update(rule.id, { is_active: 0 })

        const result = await service.evaluateAllRules('MANUAL')
        // Inactive rules are filtered out by WHERE is_active=1, so not evaluated at all
        expect(result.evaluated).toBe(0)
    })

    // ===== Logs =====

    it('getLogs() returns execution logs', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({ name: 'Log test', type: 'STOCK_ALERT', conditions: { threshold_type: 'fixed_qty', threshold_value: 1 }, actions: { notify: true }, distributorId: 1 })
        await service.evaluateRule(rule.id, 'MANUAL')

        const { logs, total } = await service.getLogs()
        expect(total).toBeGreaterThan(0)
        expect(logs[0].rule_name).toBe('Log test')
    })
})

describe('Automation Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('GET /automation returns rules (admin)', async () => {
        // Create a rule first
        const service = new AutomationService(env.DB)
        await service.create({ name: 'Test', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 1 })

        const res = await SELF.fetch('http://localhost/api/v1/automation', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.rules.length).toBe(1)
    })

    it('GET /automation rejects non-admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/automation', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(403)
    })

    it('POST /automation creates a rule', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/automation', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'API test',
                type: 'STOCK_ALERT',
                conditions: { threshold_type: 'fixed_qty', threshold_value: 10 },
                actions: { notify: true },
            }),
        })
        expect(res.status).toBe(201)
        const data = await res.json() as any
        expect(data.rule.name).toBe('API test')
    })

    it('POST /automation validates required fields', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/automation', {
            method: 'POST',
            headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(400)
    })

    it('POST /automation/:id/run manually triggers rule', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({ name: 'Manual', type: 'STOCK_ALERT', conditions: { threshold_type: 'fixed_qty', threshold_value: 1 }, actions: { notify: true }, distributorId: 1 })

        const res = await SELF.fetch(`http://localhost/api/v1/automation/${rule.id}/run`, {
            method: 'POST',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.log.trigger_type).toBe('MANUAL')
    })

    it('GET /automation/logs returns execution logs', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({ name: 'Log', type: 'STOCK_ALERT', conditions: { threshold_type: 'fixed_qty', threshold_value: 1 }, actions: {}, distributorId: 1 })
        await service.evaluateRule(rule.id, 'MANUAL')

        const res = await SELF.fetch('http://localhost/api/v1/automation/logs', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.total).toBeGreaterThan(0)
    })

    it('DELETE /automation/:id deletes a rule', async () => {
        const service = new AutomationService(env.DB)
        const rule = await service.create({ name: 'Del', type: 'STOCK_ALERT', conditions: {}, actions: {}, distributorId: 1 })

        const res = await SELF.fetch(`http://localhost/api/v1/automation/${rule.id}`, {
            method: 'DELETE',
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.success).toBe(true)
    })
})
