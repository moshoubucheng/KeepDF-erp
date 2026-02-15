const SUPPORTED_EVENTS = [
    'ORDER_CREATED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED',
    'RETURN_CREATED', 'RETURN_REFUNDED', 'STOCK_LOW', 'COMMISSION_SETTLED',
] as const

export class WebhookService {
    constructor(private db: D1Database) {}

    async listEndpoints(distributorId: number, role: string): Promise<any[]> {
        let sql = 'SELECT * FROM webhook_endpoints'
        const params: number[] = []
        if (role !== 'admin') {
            sql += ' WHERE distributor_id = ?'
            params.push(distributorId)
        }
        sql += ' ORDER BY created_at DESC'

        const { results } = await this.db.prepare(sql).bind(...params).all()
        return results
    }

    async createEndpoint(data: {
        name: string
        url: string
        secret?: string
        events: string[]
    }, distributorId: number): Promise<any> {
        if (!data.name || !data.url) throw new Error('name and url are required')
        if (!data.events?.length) throw new Error('At least one event is required')

        const invalidEvents = data.events.filter(e => !SUPPORTED_EVENTS.includes(e as any))
        if (invalidEvents.length > 0) {
            throw new Error(`Invalid events: ${invalidEvents.join(', ')}. Supported: ${SUPPORTED_EVENTS.join(', ')}`)
        }

        const { meta } = await this.db.prepare(
            `INSERT INTO webhook_endpoints (name, url, secret, events, distributor_id)
             VALUES (?, ?, ?, ?, ?)`
        ).bind(
            data.name, data.url, data.secret || null,
            JSON.stringify(data.events), distributorId,
        ).run()

        return this.db.prepare('SELECT * FROM webhook_endpoints WHERE id = ?').bind(meta.last_row_id).first()
    }

    async updateEndpoint(id: number, data: Partial<{
        name: string; url: string; secret: string
        events: string[]; is_active: number
    }>, distributorId: number, role: string): Promise<any | null> {
        let sql = 'SELECT * FROM webhook_endpoints WHERE id = ?'
        const params: number[] = [id]
        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }
        const existing = await this.db.prepare(sql).bind(...params).first()
        if (!existing) return null

        const fields: string[] = []
        const binds: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); binds.push(data.name) }
        if (data.url !== undefined) { fields.push('url = ?'); binds.push(data.url) }
        if (data.secret !== undefined) { fields.push('secret = ?'); binds.push(data.secret) }
        if (data.events !== undefined) { fields.push('events = ?'); binds.push(JSON.stringify(data.events)) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); binds.push(data.is_active) }

        if (fields.length === 0) return existing
        binds.push(id)

        await this.db.prepare(`UPDATE webhook_endpoints SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run()
        return this.db.prepare('SELECT * FROM webhook_endpoints WHERE id = ?').bind(id).first()
    }

    async deleteEndpoint(id: number, distributorId: number, role: string): Promise<boolean> {
        let sql = 'DELETE FROM webhook_endpoints WHERE id = ?'
        const params: number[] = [id]
        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }
        const { meta } = await this.db.prepare(sql).bind(...params).run()
        return (meta.changes ?? 0) > 0
    }

    async triggerEvent(event: string, payload: any, distributorId: number): Promise<{ triggered: number; errors: number }> {
        const { results: endpoints } = await this.db.prepare(
            'SELECT * FROM webhook_endpoints WHERE is_active = 1 AND distributor_id = ?'
        ).bind(distributorId).all<any>()

        let triggered = 0
        let errors = 0

        for (const endpoint of endpoints) {
            const events: string[] = JSON.parse(endpoint.events || '[]')
            if (!events.includes(event)) continue

            try {
                await this.sendWebhook(endpoint, event, payload)
                triggered++
            } catch (e) {
                errors++
            }
        }

        return { triggered, errors }
    }

    async sendWebhook(endpoint: any, event: string, payload: any): Promise<void> {
        const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }

        // HMAC-SHA256 signature
        if (endpoint.secret) {
            const encoder = new TextEncoder()
            const key = await crypto.subtle.importKey(
                'raw', encoder.encode(endpoint.secret),
                { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
            )
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
            const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
            headers['X-Webhook-Signature'] = `sha256=${hex}`
        }

        const startTime = Date.now()
        let statusCode = 0
        let responseBody = ''
        let success = false

        try {
            const response = await fetch(endpoint.url, { method: 'POST', headers, body })
            statusCode = response.status
            responseBody = (await response.text()).slice(0, 1000)
            success = response.ok

            // Update last triggered
            await this.db.prepare(
                'UPDATE webhook_endpoints SET last_triggered_at = CURRENT_TIMESTAMP, failure_count = ? WHERE id = ?'
            ).bind(success ? 0 : endpoint.failure_count + 1, endpoint.id).run()
        } catch (e: any) {
            responseBody = e.message || 'Network error'
            await this.db.prepare(
                'UPDATE webhook_endpoints SET failure_count = failure_count + 1 WHERE id = ?'
            ).bind(endpoint.id).run()
        }

        const durationMs = Date.now() - startTime

        // Log
        await this.db.prepare(
            `INSERT INTO webhook_logs (endpoint_id, event, payload, status_code, response_body, success, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(endpoint.id, event, body, statusCode, responseBody, success ? 1 : 0, durationMs).run()

        if (!success) throw new Error(`Webhook failed: ${statusCode}`)
    }

    async listLogs(endpointId: number, limit = 50, offset = 0): Promise<{ logs: any[]; total: number }> {
        const safeLimit = Math.min(Math.max(1, limit), 200)

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(
                'SELECT * FROM webhook_logs WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
            ).bind(endpointId, safeLimit, offset).all(),
            this.db.prepare(
                'SELECT COUNT(*) as total FROM webhook_logs WHERE endpoint_id = ?'
            ).bind(endpointId).first<{ total: number }>(),
        ])

        return { logs: results, total: countResult?.total || 0 }
    }

    async retryWebhook(logId: number): Promise<any> {
        const log = await this.db.prepare('SELECT * FROM webhook_logs WHERE id = ?').bind(logId).first<any>()
        if (!log) throw new Error('Log not found')

        const endpoint = await this.db.prepare('SELECT * FROM webhook_endpoints WHERE id = ?').bind(log.endpoint_id).first<any>()
        if (!endpoint) throw new Error('Endpoint not found')

        const payload = JSON.parse(log.payload || '{}')
        await this.sendWebhook(endpoint, log.event, payload.data || payload)

        return { success: true, logId }
    }
}
