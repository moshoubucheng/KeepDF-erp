import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

const TOKEN = 'tok_dev_abc123'   // distributor 1 = admin
const TOKEN_2 = 'tok_dev_def456' // distributor 2

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

/** Helper: generate an invoice for order 1 */
async function createInvoice(): Promise<any> {
    const res = await SELF.fetch('http://localhost/api/v1/invoices/generate/1', {
        method: 'POST',
        headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerName: '\u30C6\u30B9\u30C8\u8CB7\u4E3B\u682A\u5F0F\u4F1A\u793E' }),
    })
    return res.json()
}

describe('Invoice PDF', () => {
    beforeEach(async () => {
        await setupDB(env.DB)
        await env.KV.delete(`session:${TOKEN}`)
        await env.KV.delete(`session:${TOKEN_2}`)
    })

    describe('POST /api/v1/invoices/:id/pdf', () => {
        it('generates PDF and returns 201', async () => {
            const created = await createInvoice()
            const invoiceId = created.invoice.id

            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(201)
            const data = await res.json() as any
            expect(data.success).toBe(true)
            expect(data.pdf_url).toContain('invoices/')
            expect(data.pdf_url).toContain('.pdf')
        })

        it('returns 409 when PDF already generated', async () => {
            const created = await createInvoice()
            const invoiceId = created.invoice.id

            // Generate first PDF
            await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })

            // Try again
            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(409)
        })

        it('returns 404 for non-existent invoice', async () => {
            const res = await SELF.fetch('http://localhost/api/v1/invoices/999/pdf', {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })

        it('returns 403 for other distributor invoice', async () => {
            const created = await createInvoice()
            const invoiceId = created.invoice.id

            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                method: 'POST',
                headers: authHeaders(TOKEN_2),
            })
            expect(res.status).toBe(403)
        })
    })

    describe('GET /api/v1/invoices/:id/pdf', () => {
        it('downloads PDF with correct content type', async () => {
            const created = await createInvoice()
            const invoiceId = created.invoice.id

            // Generate PDF first
            await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                method: 'POST',
                headers: authHeaders(TOKEN),
            })

            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toBe('application/pdf')

            const body = await res.arrayBuffer()
            const bytes = new Uint8Array(body)
            const header = new TextDecoder().decode(bytes.slice(0, 10))
            expect(header).toContain('%PDF')
        })

        it('returns 404 when no PDF generated yet', async () => {
            const created = await createInvoice()
            const invoiceId = created.invoice.id

            const res = await SELF.fetch(`http://localhost/api/v1/invoices/${invoiceId}/pdf`, {
                headers: authHeaders(TOKEN),
            })
            expect(res.status).toBe(404)
        })
    })
})
