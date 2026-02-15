import { Hono } from 'hono'
import type { Bindings, Variables, Distributor } from '../db/types'
import { AuditService } from '../services/audit.service'
import { PasswordService } from '../services/password.service'
import { TOTPService } from '../services/totp.service'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** Generate a random session token */
function generateSessionToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** POST /auth/login - Dual-mode login (token or username+password) */
auth.post('/login', async (c) => {
    const body = await c.req.json<{ token?: string; username?: string; password?: string }>()

    // === Token mode (backward compatible) ===
    if (body.token) {
        const distributor = await c.env.DB.prepare(
            'SELECT id, name, balance, frozen_balance, tax_reg_number, role, language FROM distributors WHERE token = ?'
        ).bind(body.token).first<Distributor>()

        if (!distributor) {
            return c.json({ error: 'Invalid token' }, 401)
        }

        const role = distributor.role || 'distributor'
        await c.env.KV.put(`session:${body.token}`, `${distributor.id}:${role}`, { expirationTtl: 3600 })

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: distributor.id,
            action: 'LOGIN',
            resourceType: 'distributor',
            resourceId: String(distributor.id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({
            success: true,
            distributor: {
                id: distributor.id,
                name: distributor.name,
                balance: distributor.balance,
                frozen_balance: distributor.frozen_balance,
                tax_reg_number: distributor.tax_reg_number,
                role,
                language: distributor.language || 'ja',
            },
            token: body.token,
            expiresIn: 3600,
        })
    }

    // === Password mode ===
    if (!body.username || !body.password) {
        return c.json({ error: 'Username and password are required' }, 400)
    }

    const distributor = await c.env.DB.prepare(
        'SELECT id, name, balance, frozen_balance, tax_reg_number, role, language, password_hash, totp_enabled, totp_secret FROM distributors WHERE username = ?'
    ).bind(body.username).first<Distributor>()

    if (!distributor || !distributor.password_hash) {
        return c.json({ error: 'Invalid credentials' }, 401)
    }

    const passwordValid = await PasswordService.verify(body.password, distributor.password_hash)
    if (!passwordValid) {
        return c.json({ error: 'Invalid credentials' }, 401)
    }

    // If TOTP is enabled, require 2FA
    if (distributor.totp_enabled) {
        const tempToken = generateSessionToken()
        await c.env.KV.put(`2fa_pending:${tempToken}`, String(distributor.id), { expirationTtl: 300 })
        return c.json({ requires_2fa: true, temp_token: tempToken })
    }

    // No 2FA — create session directly
    const role = distributor.role || 'distributor'
    const sessionToken = generateSessionToken()
    await c.env.KV.put(`session:${sessionToken}`, `${distributor.id}:${role}`, { expirationTtl: 3600 })

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: distributor.id,
        action: 'LOGIN_PASSWORD',
        resourceType: 'distributor',
        resourceId: String(distributor.id),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({
        success: true,
        distributor: {
            id: distributor.id,
            name: distributor.name,
            balance: distributor.balance,
            frozen_balance: distributor.frozen_balance,
            tax_reg_number: distributor.tax_reg_number,
            role,
            language: distributor.language || 'ja',
        },
        token: sessionToken,
        expiresIn: 3600,
    })
})

/** POST /auth/verify-2fa - Verify TOTP code after password login */
auth.post('/verify-2fa', async (c) => {
    const body = await c.req.json<{ temp_token: string; code: string }>()
    if (!body.temp_token || !body.code) {
        return c.json({ error: 'temp_token and code are required' }, 400)
    }

    const distributorId = await c.env.KV.get(`2fa_pending:${body.temp_token}`)
    if (!distributorId) {
        return c.json({ error: 'Invalid or expired token' }, 401)
    }

    const distributor = await c.env.DB.prepare(
        'SELECT id, name, balance, frozen_balance, tax_reg_number, role, language, totp_secret FROM distributors WHERE id = ?'
    ).bind(Number(distributorId)).first<Distributor>()

    if (!distributor || !distributor.totp_secret) {
        return c.json({ error: 'Invalid token' }, 401)
    }

    const valid = await TOTPService.verify(distributor.totp_secret, body.code)
    if (!valid) {
        return c.json({ error: 'Invalid TOTP code' }, 401)
    }

    // Delete temp token
    await c.env.KV.delete(`2fa_pending:${body.temp_token}`)

    // Create session
    const role = distributor.role || 'distributor'
    const sessionToken = generateSessionToken()
    await c.env.KV.put(`session:${sessionToken}`, `${distributor.id}:${role}`, { expirationTtl: 3600 })

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: distributor.id,
        action: 'LOGIN_PASSWORD',
        resourceType: 'distributor',
        resourceId: String(distributor.id),
        details: '2FA verified',
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({
        success: true,
        distributor: {
            id: distributor.id,
            name: distributor.name,
            balance: distributor.balance,
            frozen_balance: distributor.frozen_balance,
            tax_reg_number: distributor.tax_reg_number,
            role,
            language: distributor.language || 'ja',
        },
        token: sessionToken,
        expiresIn: 3600,
    })
})

/** POST /auth/totp/setup - Get TOTP secret for setup (requires login) */
auth.post('/totp/setup', async (c) => {
    const distributorId = c.get('distributorId')

    const distributor = await c.env.DB.prepare(
        'SELECT id, username, totp_enabled FROM distributors WHERE id = ?'
    ).bind(distributorId).first<{ id: number; username: string | null; totp_enabled: number }>()

    if (!distributor) {
        return c.json({ error: 'Distributor not found' }, 404)
    }

    if (distributor.totp_enabled) {
        return c.json({ error: '2FA is already enabled' }, 400)
    }

    const secret = TOTPService.generateSecret()
    await c.env.KV.put(`totp_setup:${distributorId}`, secret, { expirationTtl: 600 })

    const otpauthUri = TOTPService.generateOtpAuthUri(secret, distributor.username || String(distributorId))

    return c.json({ secret, otpauth_uri: otpauthUri })
})

/** POST /auth/totp/verify-setup - Confirm TOTP setup (requires login) */
auth.post('/totp/verify-setup', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ code: string }>()

    if (!body.code || body.code.length !== 6) {
        return c.json({ error: 'A 6-digit code is required' }, 400)
    }

    const secret = await c.env.KV.get(`totp_setup:${distributorId}`)
    if (!secret) {
        return c.json({ error: 'No pending TOTP setup. Call /auth/totp/setup first' }, 400)
    }

    const valid = await TOTPService.verify(secret, body.code)
    if (!valid) {
        return c.json({ error: 'Invalid code' }, 401)
    }

    // Save to DB
    await c.env.DB.prepare(
        'UPDATE distributors SET totp_secret = ?, totp_enabled = 1 WHERE id = ?'
    ).bind(secret, distributorId).run()

    await c.env.KV.delete(`totp_setup:${distributorId}`)

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'ENABLE_2FA',
        resourceType: 'distributor',
        resourceId: String(distributorId),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, message: '2FA enabled successfully' })
})

/** POST /auth/totp/disable - Disable TOTP (requires login + current code) */
auth.post('/totp/disable', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ code: string }>()

    if (!body.code) {
        return c.json({ error: 'TOTP code is required' }, 400)
    }

    const distributor = await c.env.DB.prepare(
        'SELECT totp_secret, totp_enabled FROM distributors WHERE id = ?'
    ).bind(distributorId).first<{ totp_secret: string | null; totp_enabled: number }>()

    if (!distributor || !distributor.totp_enabled || !distributor.totp_secret) {
        return c.json({ error: '2FA is not enabled' }, 400)
    }

    const valid = await TOTPService.verify(distributor.totp_secret, body.code)
    if (!valid) {
        return c.json({ error: 'Invalid TOTP code' }, 401)
    }

    await c.env.DB.prepare(
        'UPDATE distributors SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?'
    ).bind(distributorId).run()

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'DISABLE_2FA',
        resourceType: 'distributor',
        resourceId: String(distributorId),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, message: '2FA disabled successfully' })
})

/** POST /auth/change-password - Change password (requires login) */
auth.post('/change-password', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ current_password: string; new_password: string }>()

    if (!body.current_password || !body.new_password) {
        return c.json({ error: 'Current and new passwords are required' }, 400)
    }

    if (body.new_password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const distributor = await c.env.DB.prepare(
        'SELECT password_hash FROM distributors WHERE id = ?'
    ).bind(distributorId).first<{ password_hash: string | null }>()

    if (!distributor || !distributor.password_hash) {
        return c.json({ error: 'Password not set. Contact admin.' }, 400)
    }

    const valid = await PasswordService.verify(body.current_password, distributor.password_hash)
    if (!valid) {
        return c.json({ error: 'Current password is incorrect' }, 401)
    }

    const newHash = await PasswordService.hash(body.new_password)
    await c.env.DB.prepare(
        'UPDATE distributors SET password_hash = ? WHERE id = ?'
    ).bind(newHash, distributorId).run()

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'CHANGE_PASSWORD',
        resourceType: 'distributor',
        resourceId: String(distributorId),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true, message: 'Password changed successfully' })
})

/** POST /auth/language - Save language preference */
auth.post('/language', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ language: string }>()

    const validLangs = ['ja', 'en', 'zh']
    if (!body.language || !validLangs.includes(body.language)) {
        return c.json({ error: 'Invalid language. Must be ja, en, or zh' }, 400)
    }

    await c.env.DB.prepare(
        'UPDATE distributors SET language = ? WHERE id = ?'
    ).bind(body.language, distributorId).run()

    return c.json({ success: true, language: body.language })
})

/** POST /auth/logout - Clear session */
auth.post('/logout', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        await c.env.KV.delete(`session:${token}`)
    }
    return c.json({ success: true, message: 'Logged out successfully' })
})

/** GET /auth/me - Get current user info */
auth.get('/me', async (c) => {
    const distributorId = c.get('distributorId')
    const distributor = await c.env.DB.prepare(
        'SELECT id, name, username, balance, frozen_balance, tax_reg_number, email, phone, address, contact_person, role, language, totp_enabled, created_at FROM distributors WHERE id = ?'
    ).bind(distributorId).first<Distributor>()

    if (!distributor) {
        return c.json({ error: 'Distributor not found' }, 404)
    }

    return c.json({
        distributor: {
            id: distributor.id,
            name: distributor.name,
            username: distributor.username,
            balance: distributor.balance,
            frozen_balance: distributor.frozen_balance,
            tax_reg_number: distributor.tax_reg_number,
            email: distributor.email || '',
            phone: distributor.phone || '',
            address: distributor.address || '',
            contact_person: distributor.contact_person || '',
            role: distributor.role || 'distributor',
            language: distributor.language || 'ja',
            totp_enabled: !!distributor.totp_enabled,
            created_at: distributor.created_at,
        },
    })
})

/** PUT /auth/profile - Update company profile */
auth.put('/profile', async (c) => {
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{
        name?: string; tax_reg_number?: string; email?: string;
        phone?: string; address?: string; contact_person?: string
    }>()

    const fields: string[] = []
    const values: (string | number)[] = []

    if (body.name !== undefined && body.name.trim()) {
        fields.push('name = ?')
        values.push(body.name.trim().slice(0, 200))
    }
    if (body.tax_reg_number !== undefined) {
        fields.push('tax_reg_number = ?')
        values.push(body.tax_reg_number.trim().slice(0, 50))
    }
    if (body.email !== undefined) {
        fields.push('email = ?')
        values.push(body.email.trim().slice(0, 200))
    }
    if (body.phone !== undefined) {
        fields.push('phone = ?')
        values.push(body.phone.trim().slice(0, 30))
    }
    if (body.address !== undefined) {
        fields.push('address = ?')
        values.push(body.address.trim().slice(0, 500))
    }
    if (body.contact_person !== undefined) {
        fields.push('contact_person = ?')
        values.push(body.contact_person.trim().slice(0, 100))
    }

    if (fields.length === 0) {
        return c.json({ error: 'No fields to update' }, 400)
    }

    values.push(distributorId)
    await c.env.DB.prepare(`UPDATE distributors SET ${fields.join(', ')} WHERE id = ?`)
        .bind(...values).run()

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId,
        action: 'UPDATE_PROFILE',
        resourceType: 'distributor',
        resourceId: String(distributorId),
        details: JSON.stringify(Object.keys(body)),
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ success: true })
})

export { auth }
