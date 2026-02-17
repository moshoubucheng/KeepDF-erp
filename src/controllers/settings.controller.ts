import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { adminOnly } from '../middleware/admin'
import { PasswordService } from '../services/password.service'
import { AuditService } from '../services/audit.service'

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All settings routes require admin
settings.use('/*', adminOnly)

/** GET /settings/config - Get business config (from KV) */
settings.get('/config', async (c) => {
    const configStr = await c.env.KV.get('business_config')
    const config = configStr ? JSON.parse(configStr) : {
        low_stock_threshold: 10,
        auto_sync_enabled: true,
        commission_auto_settle: true,
        backup_enabled: true,
        default_carrier: 'YAMATO',
        default_tax_category: 'standard',
    }

    return c.json({ config })
})

/** PUT /settings/config - Update business config */
settings.put('/config', async (c) => {
    const body = await c.req.json<Record<string, any>>()

    // Merge with existing config
    const existingStr = await c.env.KV.get('business_config')
    const existing = existingStr ? JSON.parse(existingStr) : {}
    const merged = { ...existing, ...body }

    await c.env.KV.put('business_config', JSON.stringify(merged))

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'UPDATE_CONFIG',
        resourceType: 'settings',
        details: JSON.stringify(Object.keys(body)),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, config: merged })
})

/** GET /settings/system-info - System overview */
settings.get('/system-info', async (c) => {
    const tables = [
        { name: 'distributors', label: 'Distributors' },
        { name: 'products', label: 'Products' },
        { name: 'orders', label: 'Orders' },
        { name: 'shipments', label: 'Shipments' },
        { name: 'customers', label: 'Customers' },
        { name: 'invoices', label: 'Invoices' },
        { name: 'commission_settlements', label: 'Settlements' },
        { name: 'notifications', label: 'Notifications' },
    ]

    // Whitelist: only allow known table names to prevent SQL injection
    const ALLOWED_TABLES = new Set(tables.map(t => t.name))

    const counts: Record<string, number> = {}
    for (const table of tables) {
        if (!ALLOWED_TABLES.has(table.name)) continue
        const result = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM "${table.name}"`
        ).first<{ count: number }>()
        counts[table.label] = result?.count || 0
    }

    // Last sync
    const lastSync = await c.env.DB.prepare(
        "SELECT * FROM platform_sync_logs ORDER BY started_at DESC LIMIT 1"
    ).first()

    // Last backup
    const lastBackup = await c.env.DB.prepare(
        "SELECT * FROM backup_snapshots ORDER BY created_at DESC LIMIT 1"
    ).first()

    return c.json({
        counts,
        lastSync: lastSync || null,
        lastBackup: lastBackup || null,
    })
})

/** POST /settings/users/:id/reset-password - Reset user password */
settings.post('/users/:id/reset-password', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ new_password: string }>()

    if (!body.new_password || body.new_password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const user = await c.env.DB.prepare('SELECT id FROM distributors WHERE id = ?').bind(id).first()
    if (!user) return c.json({ error: 'User not found' }, 404)

    const hash = await PasswordService.hash(body.new_password)
    await c.env.DB.prepare('UPDATE distributors SET password_hash = ? WHERE id = ?').bind(hash, id).run()

    // Invalidate any cached sessions for this user
    const token = await c.env.DB.prepare('SELECT token FROM distributors WHERE id = ?').bind(id).first<{ token: string }>()
    if (token?.token) {
        await c.env.KV.delete(`session:${token.token}`)
    }

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'RESET_PASSWORD',
        resourceType: 'distributor',
        resourceId: String(id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

/** POST /settings/users/:id/disable-2fa - Disable user 2FA */
settings.post('/users/:id/disable-2fa', async (c) => {
    const id = Number(c.req.param('id'))

    const user = await c.env.DB.prepare('SELECT id, totp_enabled FROM distributors WHERE id = ?').bind(id).first<{ id: number; totp_enabled: number }>()
    if (!user) return c.json({ error: 'User not found' }, 404)

    if (!user.totp_enabled) return c.json({ error: '2FA is not enabled for this user' }, 400)

    await c.env.DB.prepare(
        'UPDATE distributors SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?'
    ).bind(id).run()

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: c.get('distributorId'),
        action: 'DISABLE_2FA',
        resourceType: 'distributor',
        resourceId: String(id),
        details: 'admin reset',
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

export { settings }
