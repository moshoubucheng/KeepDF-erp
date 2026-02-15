import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { AuditService } from '../services/audit.service'
import { adminOnly } from '../middleware/admin'

const auditRecovery = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /audit-logs/restorable - List logs with snapshots (admin) */
auditRecovery.get('/restorable', adminOnly, async (c) => {
    const limit = Number(c.req.query('limit') || 50)
    const offset = Number(c.req.query('offset') || 0)

    const { results } = await c.env.DB.prepare(
        `SELECT al.*, s.id as snapshot_id, s.before_data, s.after_data, d.name as distributor_name
         FROM audit_logs al
         INNER JOIN audit_snapshots s ON s.audit_log_id = al.id
         LEFT JOIN distributors d ON d.id = al.distributor_id
         WHERE s.before_data IS NOT NULL
         ORDER BY al.created_at DESC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all()

    const countResult = await c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM audit_snapshots WHERE before_data IS NOT NULL'
    ).first<{ total: number }>()

    return c.json({ logs: results, total: countResult?.total || 0 })
})

/** GET /audit-logs/snapshots/:logId - Get snapshot (admin) */
auditRecovery.get('/snapshots/:logId', adminOnly, async (c) => {
    const logId = Number(c.req.param('logId'))
    const snapshot = await c.env.DB.prepare(
        'SELECT * FROM audit_snapshots WHERE audit_log_id = ?'
    ).bind(logId).first()

    if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404)
    return c.json({ snapshot })
})

/** POST /audit-logs/restore/:logId - Restore from snapshot (admin) */
auditRecovery.post('/restore/:logId', adminOnly, async (c) => {
    const logId = Number(c.req.param('logId'))

    // Get the audit log and snapshot
    const auditLog = await c.env.DB.prepare('SELECT * FROM audit_logs WHERE id = ?').bind(logId).first<any>()
    if (!auditLog) return c.json({ error: 'Audit log not found' }, 404)

    const snapshot = await c.env.DB.prepare(
        'SELECT * FROM audit_snapshots WHERE audit_log_id = ?'
    ).bind(logId).first<any>()
    if (!snapshot || !snapshot.before_data) return c.json({ error: 'No restorable snapshot found' }, 404)

    const beforeData = JSON.parse(snapshot.before_data)
    const resourceType = auditLog.resource_type
    const resourceId = auditLog.resource_id

    // Restore based on resource type
    const tableMap: Record<string, string> = {
        order: 'orders',
        product: 'products',
        return: 'returns',
        customer: 'customers',
        supplier: 'suppliers',
        purchase_order: 'purchase_orders',
        price_rule: 'price_rules',
    }

    const tableName = tableMap[resourceType]
    if (!tableName) return c.json({ error: `Restore not supported for: ${resourceType}` }, 400)

    // Build UPDATE statement from before_data
    const fields: string[] = []
    const binds: any[] = []
    for (const [key, value] of Object.entries(beforeData)) {
        if (key === 'id') continue
        fields.push(`${key} = ?`)
        binds.push(value)
    }

    if (fields.length === 0) return c.json({ error: 'No fields to restore' }, 400)

    binds.push(resourceId)
    await c.env.DB.prepare(
        `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...binds).run()

    // Log the restore action
    const auditService = new AuditService(c.env.DB)
    await auditService.log({
        distributorId: c.get('distributorId'),
        action: 'RESTORE_DATA' as any,
        resourceType: resourceType as any,
        resourceId: String(resourceId),
        details: `Restored from audit log #${logId}`,
    })

    return c.json({ success: true, restored: { table: tableName, id: resourceId } })
})

export { auditRecovery }
