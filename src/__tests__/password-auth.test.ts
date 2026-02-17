import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'
import { PasswordService } from '../services/password.service'

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

/** Set password for a user in the test DB */
async function setPassword(db: D1Database, username: string, password: string) {
    const hash = await PasswordService.hash(password)
    await db.prepare('UPDATE distributors SET password_hash = ? WHERE username = ?').bind(hash, username).run()
}

const TOKEN = 'tok_dev_abc123'

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('Password Authentication', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        // Set passwords for test users
        await setPassword(env.DB, 'admin', 'password123')
        await setPassword(env.DB, 'dist2', 'password123')
        // Clean KV
        await env.KV.delete(`session:${TOKEN}`)
    })

    describe('PasswordService', () => {
        it('hash() produces salt:hash format', async () => {
            const result = await PasswordService.hash('testpass')
            expect(result).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/)
        })

        it('verify() returns true for correct password', async () => {
            const hash = await PasswordService.hash('mypassword')
            const result = await PasswordService.verify('mypassword', hash)
            expect(result).toBe(true)
        })

        it('verify() returns false for wrong password', async () => {
            const hash = await PasswordService.hash('correctpass')
            const result = await PasswordService.verify('wrongpass', hash)
            expect(result).toBe(false)
        })
    })

    describe('POST /api/v1/auth/login (password mode)', () => {
        it('password login success', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.token).toBeDefined()
            expect(data.distributor.id).toBe(1)
            expect(data.distributor.role).toBe('admin')
            expect(data.distributor.language).toBe('ja')
            expect(data.expiresIn).toBe(3600)
        })

        it('wrong password returns 401', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'wrongpass' }),
            })
            expect(res.status).toBe(401)
            const data = await res.json() as any
            expect(data.error).toBe('Invalid credentials')
        })

        it('non-existent username returns 401 (no info leak)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'nobody', password: 'password123' }),
            })
            expect(res.status).toBe(401)
            const data = await res.json() as any
            expect(data.error).toBe('Invalid credentials')
        })

        it('token login still works (backward compatible)', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: TOKEN }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.distributor.id).toBe(1)
        })

        it('missing username/password returns 400', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin' }),
            })
            expect(res.status).toBe(400)
        })
    })

    describe('POST /api/v1/auth/change-password', () => {
        it('change password success', async () => {
            // Login first
            const loginRes = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            const loginData = await loginRes.json() as any
            const sessionToken = loginData.token

            // Change password
            const res = await SELF.fetch('http://localhost/api/v1/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders(sessionToken),
                },
                body: JSON.stringify({ current_password: 'password123', new_password: 'newpassword456' }),
            })
            expect(res.status).toBe(200)
            const data = await res.json() as any
            expect(data.success).toBe(true)

            // Verify new password works
            const res2 = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'newpassword456' }),
            })
            expect(res2.status).toBe(200)
        })

        it('wrong current password returns 401', async () => {
            const loginRes = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            const loginData = await loginRes.json() as any
            const sessionToken = loginData.token

            const res = await SELF.fetch('http://localhost/api/v1/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
                body: JSON.stringify({ current_password: 'wrongold', new_password: 'newpassword456' }),
            })
            expect(res.status).toBe(401)
        })

        it('short new password (<8) returns 400', async () => {
            const loginRes = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            const loginData = await loginRes.json() as any
            const sessionToken = loginData.token

            const res = await SELF.fetch('http://localhost/api/v1/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
                body: JSON.stringify({ current_password: 'password123', new_password: 'short' }),
            })
            expect(res.status).toBe(400)
        })
    })

    describe('Session token from password login', () => {
        it('session token can access protected endpoints', async () => {
            const loginRes = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            const loginData = await loginRes.json() as any
            const sessionToken = loginData.token

            const meRes = await SELF.fetch('http://localhost/api/v1/auth/me', {
                headers: authHeaders(sessionToken),
            })
            expect(meRes.status).toBe(200)
            const meData = await meRes.json() as any
            expect(meData.distributor.id).toBe(1)
        })
    })
})
