import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { AuditService } from '../services/audit.service'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // distributor 1 = admin
const TOKEN_2 = 'tok_dev_def456' // distributor 2 = distributor

const TABLE_NAMES = [
    'audit_logs', 'platform_sync_logs', 'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commission_settlements', 'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
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

describe('Audit Service', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
    })

    it('log() writes an audit record', async () => {
        const service = new AuditService(env.DB)
        await service.log({
            distributorId: 1,
            action: 'LOGIN',
            resourceType: 'distributor',
            resourceId: '1',
            ipAddress: '127.0.0.1',
        })

        const { results } = await env.DB.prepare('SELECT * FROM audit_logs').all()
        expect(results.length).toBe(1)
        expect(results[0].action).toBe('LOGIN')
        expect(results[0].resource_type).toBe('distributor')
    })

    it('log() does not throw on DB error', async () => {
        // Create service with a mock that would fail
        const service = new AuditService(env.DB)

        // Drop the table to simulate error
        await env.DB.prepare('DROP TABLE audit_logs').run()

        // Should not throw
        await expect(service.log({
            distributorId: 1,
            action: 'LOGIN',
            resourceType: 'distributor',
        })).resolves.toBeUndefined()
    })

    it('query() returns filtered results', async () => {
        const service = new AuditService(env.DB)

        // Insert test data
        await service.log({ distributorId: 1, action: 'LOGIN', resourceType: 'distributor', resourceId: '1' })
        await service.log({ distributorId: 1, action: 'DEPOSIT', resourceType: 'wallet', resourceId: '1' })
        await service.log({ distributorId: 2, action: 'LOGIN', resourceType: 'distributor', resourceId: '2' })

        // Filter by action
        const { logs, total } = await service.query({ action: 'LOGIN' })
        expect(logs.length).toBe(2)
        expect(total).toBe(2)

        // Filter by distributor
        const { logs: d1Logs } = await service.query({ distributorId: 1 })
        expect(d1Logs.length).toBe(2)
    })

    it('exportCSV() returns CSV string', async () => {
        const service = new AuditService(env.DB)
        await service.log({ distributorId: 1, action: 'LOGIN', resourceType: 'distributor' })

        const csv = await service.exportCSV({})
        expect(csv).toContain('ID')
        expect(csv).toContain('LOGIN')
    })
})

describe('Audit Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    it('GET /audit-logs returns logs for admin', async () => {
        // Create some audit data
        const service = new AuditService(env.DB)
        await service.log({ distributorId: 1, action: 'LOGIN', resourceType: 'distributor' })

        const res = await SELF.fetch('http://localhost/api/v1/audit-logs', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.logs.length).toBeGreaterThanOrEqual(1)
    })

    it('returns 403 for non-admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/audit-logs', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(403)
    })

    it('GET /audit-logs/export returns CSV for admin', async () => {
        const service = new AuditService(env.DB)
        await service.log({ distributorId: 1, action: 'LOGIN', resourceType: 'distributor' })

        const res = await SELF.fetch('http://localhost/api/v1/audit-logs/export', {
            headers: authHeaders(TOKEN),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
    })

    it('login action creates audit log automatically', async () => {
        // Login
        await SELF.fetch('http://localhost/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN }),
        })

        // Check audit log
        const { results } = await env.DB.prepare(
            "SELECT * FROM audit_logs WHERE action = 'LOGIN'"
        ).all()
        expect(results.length).toBeGreaterThanOrEqual(1)
    })
})
