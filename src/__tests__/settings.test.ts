import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // admin (distributor_id=1)
const TOKEN_2 = 'tok_dev_def456' // distributor (distributor_id=2)

const TABLE_NAMES = [
    'notification_preferences', 'notifications', 'import_logs', 'shipments', 'customers',
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

describe('Settings Controller', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
        await env.KV.delete('business_config')
    })

    // ===== Admin-only Access =====
    it('returns 403 for non-admin', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/settings/config', {
            headers: authHeaders(TOKEN_2),
        })
        expect(res.status).toBe(403)
    })

    it('returns 401 without auth', async () => {
        const res = await SELF.fetch('http://localhost/api/v1/settings/config')
        expect(res.status).toBe(401)
    })

    // ===== Config =====
    describe('GET /settings/config', () => {
        it('returns default config when none set', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/config', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.config.low_stock_threshold).toBe(10)
            expect(data.config.default_carrier).toBe('YAMATO')
        })

        it('returns stored config', async () => {
            await env.KV.put('business_config', JSON.stringify({ low_stock_threshold: 20 }))

            const res = await SELF.fetch('http://localhost/api/v1/settings/config', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.config.low_stock_threshold).toBe(20)
        })
    })

    describe('PUT /settings/config', () => {
        it('updates config', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/config', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ low_stock_threshold: 15, default_carrier: 'SAGAWA' }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.config.low_stock_threshold).toBe(15)
            expect(data.config.default_carrier).toBe('SAGAWA')
        })

        it('merges with existing config', async () => {
            await env.KV.put('business_config', JSON.stringify({ existing_key: 'keep', low_stock_threshold: 5 }))

            const res = await SELF.fetch('http://localhost/api/v1/settings/config', {
                method: 'PUT',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ low_stock_threshold: 25 }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.config.existing_key).toBe('keep')
            expect(data.config.low_stock_threshold).toBe(25)
        })
    })

    // ===== System Info =====
    describe('GET /settings/system-info', () => {
        it('returns table counts', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/system-info', {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.counts).toBeTruthy()
            expect(data.counts['Distributors']).toBe(4)
            expect(data.counts['Products']).toBe(6)
            expect(data.counts['Orders']).toBe(5)
        })

        it('includes lastSync and lastBackup', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/system-info', {
                headers: authHeaders(TOKEN),
            })
            const data = await res.json() as any
            expect('lastSync' in data).toBe(true)
            expect('lastBackup' in data).toBe(true)
        })
    })

    // ===== Reset Password =====
    describe('POST /settings/users/:id/reset-password', () => {
        it('resets user password', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/users/2/reset-password', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: 'newpassword123' }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)

            // Verify password hash was updated
            const user = await env.DB.prepare('SELECT password_hash FROM distributors WHERE id = 2').first()
            expect(user!.password_hash).toBeTruthy()
        })

        it('rejects short password', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/users/2/reset-password', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: '123' }),
            })
            expect(res.status).toBe(400)
        })

        it('returns 404 for non-existent user', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/users/999/reset-password', {
                method: 'POST',
                headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: 'newpassword123' }),
            })
            expect(res.status).toBe(404)
        })
    })

    // ===== Disable 2FA =====
    describe('POST /settings/users/:id/disable-2fa', () => {
        it('disables 2FA for user with TOTP enabled', async () => {
            // Enable 2FA first
            await env.DB.prepare(
                "UPDATE distributors SET totp_secret = 'test_secret', totp_enabled = 1 WHERE id = 2"
            ).run()

            const res = await SELF.fetch('http://localhost/api/v1/settings/users/2/disable-2fa', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)

            // Verify 2FA is disabled
            const user = await env.DB.prepare('SELECT totp_enabled, totp_secret FROM distributors WHERE id = 2').first()
            expect(user!.totp_enabled).toBe(0)
            expect(user!.totp_secret).toBeNull()
        })

        it('returns 400 if 2FA not enabled', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/users/2/disable-2fa', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(400)
        })

        it('returns 404 for non-existent user', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/settings/users/999/disable-2fa', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })
})
