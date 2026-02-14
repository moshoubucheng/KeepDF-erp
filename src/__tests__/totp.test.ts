import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'
import { PasswordService } from '../services/password.service'
import { TOTPService } from '../services/totp.service'

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

async function setPassword(db: D1Database, username: string, password: string) {
    const hash = await PasswordService.hash(password)
    await db.prepare('UPDATE distributors SET password_hash = ? WHERE username = ?').bind(hash, username).run()
}

async function loginAndGetToken(username = 'admin', password = 'password123'): Promise<string> {
    const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    })
    const data = await res.json() as any
    return data.token
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` }
}

describe('TOTP Two-Factor Authentication', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await setPassword(env.DB, 'admin', 'password123')
        await setPassword(env.DB, 'dist2', 'password123')
    })

    describe('TOTPService', () => {
        it('generateSecret() returns 32 character Base32 string', () => {
            const secret = TOTPService.generateSecret()
            expect(secret).toMatch(/^[A-Z2-7]{32}$/)
        })

        it('generateCode() returns 6 digit string', async () => {
            const secret = TOTPService.generateSecret()
            const code = await TOTPService.generateCode(secret)
            expect(code).toMatch(/^\d{6}$/)
        })

        it('verify() passes for current code', async () => {
            const secret = TOTPService.generateSecret()
            const code = await TOTPService.generateCode(secret)
            const result = await TOTPService.verify(secret, code)
            expect(result).toBe(true)
        })

        it('verify() fails for wrong code', async () => {
            const secret = TOTPService.generateSecret()
            const result = await TOTPService.verify(secret, '000000')
            // Could be true if the actual code happens to be 000000, but very unlikely
            // Use a fixed time approach instead
            const code = await TOTPService.generateCode(secret)
            const wrongCode = code === '123456' ? '654321' : '123456'
            const result2 = await TOTPService.verify(secret, wrongCode, 0)
            expect(result2).toBe(false)
        })

        it('generateOtpAuthUri() returns valid URI', () => {
            const secret = TOTPService.generateSecret()
            const uri = TOTPService.generateOtpAuthUri(secret, 'testuser')
            expect(uri).toContain('otpauth://totp/')
            expect(uri).toContain('KeepDF')
            expect(uri).toContain(secret)
            expect(uri).toContain('testuser')
        })
    })

    describe('2FA Setup Flow', () => {
        it('setup → verify → enable', async () => {
            const token = await loginAndGetToken()

            // Step 1: Get TOTP secret
            const setupRes = await SELF.fetch('http://localhost/api/v1/auth/totp/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
            })
            expect(setupRes.status).toBe(200)
            const setupData = await setupRes.json() as any
            expect(setupData.secret).toBeDefined()
            expect(setupData.otpauth_uri).toContain('otpauth://totp/')

            // Step 2: Generate code and verify
            const code = await TOTPService.generateCode(setupData.secret)
            const verifyRes = await SELF.fetch('http://localhost/api/v1/auth/totp/verify-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ code }),
            })
            expect(verifyRes.status).toBe(200)
            const verifyData = await verifyRes.json() as any
            expect(verifyData.success).toBe(true)

            // Verify DB was updated
            const dist = await env.DB.prepare('SELECT totp_enabled, totp_secret FROM distributors WHERE id = 1')
                .first<{ totp_enabled: number; totp_secret: string }>()
            expect(dist?.totp_enabled).toBe(1)
            expect(dist?.totp_secret).toBe(setupData.secret)
        })

        it('setup fails if 2FA already enabled', async () => {
            const token = await loginAndGetToken()

            // Enable 2FA first
            const setupRes = await SELF.fetch('http://localhost/api/v1/auth/totp/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
            })
            const setupData = await setupRes.json() as any
            const code = await TOTPService.generateCode(setupData.secret)
            await SELF.fetch('http://localhost/api/v1/auth/totp/verify-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ code }),
            })

            // Try to setup again
            const res2 = await SELF.fetch('http://localhost/api/v1/auth/totp/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
            })
            expect(res2.status).toBe(400)
        })
    })

    describe('2FA Login Flow', () => {
        it('password login with 2FA → requires_2fa → verify-2fa → session', async () => {
            const token = await loginAndGetToken()

            // Enable 2FA
            const setupRes = await SELF.fetch('http://localhost/api/v1/auth/totp/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
            })
            const setupData = await setupRes.json() as any
            const setupCode = await TOTPService.generateCode(setupData.secret)
            await SELF.fetch('http://localhost/api/v1/auth/totp/verify-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ code: setupCode }),
            })

            // Now login with password — should require 2FA
            const loginRes = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            expect(loginRes.status).toBe(200)
            const loginData = await loginRes.json() as any
            expect(loginData.requires_2fa).toBe(true)
            expect(loginData.temp_token).toBeDefined()

            // Verify 2FA
            const totpCode = await TOTPService.generateCode(setupData.secret)
            const verifyRes = await SELF.fetch('http://localhost/api/v1/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temp_token: loginData.temp_token, code: totpCode }),
            })
            expect(verifyRes.status).toBe(200)
            const verifyData = await verifyRes.json() as any
            expect(verifyData.success).toBe(true)
            expect(verifyData.token).toBeDefined()
            expect(verifyData.distributor.id).toBe(1)
        })

        it('verify-2fa with wrong code returns 401', async () => {
            const token = await loginAndGetToken()

            // Enable 2FA
            const setupRes = await SELF.fetch('http://localhost/api/v1/auth/totp/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
            })
            const setupData = await setupRes.json() as any
            const code = await TOTPService.generateCode(setupData.secret)
            await SELF.fetch('http://localhost/api/v1/auth/totp/verify-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ code }),
            })

            // Login
            const loginRes = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'password123' }),
            })
            const loginData = await loginRes.json() as any

            // Wrong TOTP code
            const verifyRes = await SELF.fetch('http://localhost/api/v1/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temp_token: loginData.temp_token, code: '999999' }),
            })
            expect(verifyRes.status).toBe(401)
        })

        it('verify-2fa with expired temp_token returns 401', async () => {
            const verifyRes = await SELF.fetch('http://localhost/api/v1/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temp_token: 'expired_or_invalid_token', code: '123456' }),
            })
            expect(verifyRes.status).toBe(401)
        })

        it('non-2FA user does not get requires_2fa', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'dist2', password: 'password123' }),
            })
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.requires_2fa).toBeUndefined()
            expect(data.token).toBeDefined()
        })
    })

    describe('2FA Disable', () => {
        it('disable 2FA with valid code', async () => {
            const token = await loginAndGetToken()

            // Enable 2FA
            const setupRes = await SELF.fetch('http://localhost/api/v1/auth/totp/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
            })
            const setupData = await setupRes.json() as any
            const setupCode = await TOTPService.generateCode(setupData.secret)
            await SELF.fetch('http://localhost/api/v1/auth/totp/verify-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ code: setupCode }),
            })

            // Disable 2FA
            const disableCode = await TOTPService.generateCode(setupData.secret)
            const disableRes = await SELF.fetch('http://localhost/api/v1/auth/totp/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ code: disableCode }),
            })
            expect(disableRes.status).toBe(200)

            // Verify DB was updated
            const dist = await env.DB.prepare('SELECT totp_enabled, totp_secret FROM distributors WHERE id = 1')
                .first<{ totp_enabled: number; totp_secret: string | null }>()
            expect(dist?.totp_enabled).toBe(0)
            expect(dist?.totp_secret).toBeNull()
        })
    })
})
