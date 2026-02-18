import type { MessageTemplate, CustomerMessage, MessageTrigger } from '../db/types'
import { decodeCursor, buildCursorWhere, encodeCursor } from '../utils/cursor'

const VALID_TYPES = ['ORDER_CONFIRMATION', 'SHIPPING_NOTIFICATION', 'DELIVERY_CONFIRMATION', 'RETURN_APPROVED', 'RETURN_REJECTED', 'CUSTOM'] as const
const VALID_CHANNELS = ['EMAIL', 'SMS', 'IN_APP'] as const
const VALID_EVENTS = ['ORDER_CREATED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'RETURN_APPROVED', 'RETURN_REJECTED'] as const

export class CommunicationService {
    constructor(private db: D1Database) {}

    // ===== Templates =====

    async listTemplates(distributorId: number, role: string, filters?: {
        type?: string
        limit?: number
        offset?: number
    }): Promise<{ templates: MessageTemplate[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (role !== 'admin') {
            where += ' AND distributor_id = ?'
            params.push(distributorId)
        }
        if (filters?.type) {
            where += ' AND type = ?'
            params.push(filters.type.toUpperCase())
        }

        const countParams = [...params]

        const sql = `SELECT * FROM message_templates ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM message_templates ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all<MessageTemplate>(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { templates: results, total: countResult?.total || 0 }
    }

    async getTemplate(id: number, distributorId: number, role: string): Promise<MessageTemplate | null> {
        let sql = 'SELECT * FROM message_templates WHERE id = ?'
        const params: (string | number)[] = [id]

        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }

        return this.db.prepare(sql).bind(...params).first<MessageTemplate>()
    }

    async createTemplate(data: {
        name: string
        type: string
        subject?: string
        body: string
        channel?: string
        distributorId: number
    }): Promise<MessageTemplate> {
        if (!data.name?.trim()) throw new Error('Template name is required')
        if (!data.body?.trim()) throw new Error('Template body is required')

        const type = data.type.toUpperCase()
        if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
            throw new Error(`Invalid template type: ${data.type}`)
        }

        const channel = (data.channel || 'EMAIL').toUpperCase()
        if (!VALID_CHANNELS.includes(channel as typeof VALID_CHANNELS[number])) {
            throw new Error(`Invalid channel: ${data.channel}`)
        }

        const { meta } = await this.db.prepare(
            `INSERT INTO message_templates (name, type, subject, body, channel, distributor_id)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            data.name.trim(), type, data.subject || null,
            data.body.trim(), channel, data.distributorId
        ).run()

        return this.db.prepare('SELECT * FROM message_templates WHERE id = ?')
            .bind(meta.last_row_id).first<MessageTemplate>() as Promise<MessageTemplate>
    }

    async updateTemplate(id: number, data: Partial<{
        name: string
        subject: string
        body: string
        channel: string
        is_active: number
    }>, distributorId: number, role: string): Promise<MessageTemplate | null> {
        const existing = await this.getTemplate(id, distributorId, role)
        if (!existing) return null

        const fields: string[] = []
        const values: (string | number | null)[] = []

        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
        if (data.subject !== undefined) { fields.push('subject = ?'); values.push(data.subject) }
        if (data.body !== undefined) { fields.push('body = ?'); values.push(data.body) }
        if (data.channel !== undefined) { fields.push('channel = ?'); values.push(data.channel.toUpperCase()) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active) }

        if (fields.length === 0) return existing

        fields.push('updated_at = CURRENT_TIMESTAMP')
        values.push(id)

        await this.db.prepare(
            `UPDATE message_templates SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        return this.getTemplate(id, distributorId, role)
    }

    async deleteTemplate(id: number, distributorId: number, role: string): Promise<boolean> {
        const existing = await this.getTemplate(id, distributorId, role)
        if (!existing) return false
        await this.db.prepare('DELETE FROM message_templates WHERE id = ?').bind(id).run()
        return true
    }

    // ===== Messages =====

    async listMessages(distributorId: number, role: string, filters?: {
        customerId?: number
        type?: string
        limit?: number
        offset?: number
        cursor?: string
    }): Promise<{ messages: CustomerMessage[]; total: number; nextCursor?: string; hasMore?: boolean }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const baseParams: (string | number)[] = []

        if (role !== 'admin') {
            where += ' AND distributor_id = ?'
            baseParams.push(distributorId)
        }
        if (filters?.customerId) {
            where += ' AND customer_id = ?'
            baseParams.push(filters.customerId)
        }
        if (filters?.type) {
            where += ' AND type = ?'
            baseParams.push(filters.type)
        }

        const countSql = `SELECT COUNT(*) as total FROM customer_messages ${where}`
        const countResult = await this.db.prepare(countSql).bind(...baseParams).first<{ total: number }>()
        const total = countResult?.total || 0

        // Cursor-based pagination
        if (filters?.cursor) {
            const decoded = decodeCursor(filters.cursor)
            if (decoded) {
                const { clause, binds } = buildCursorWhere(decoded, 'sent_at')
                const cursorWhere = `${where} AND ${clause}`
                const sql = `SELECT * FROM customer_messages ${cursorWhere} ORDER BY sent_at DESC, id DESC LIMIT ?`
                const { results } = await this.db.prepare(sql).bind(...baseParams, ...binds, limit + 1).all<CustomerMessage>()

                const hasMore = results.length > limit
                const page = hasMore ? results.slice(0, limit) : results
                const nextCursor = hasMore && page.length > 0
                    ? encodeCursor(page[page.length - 1].sent_at, page[page.length - 1].id)
                    : undefined

                return { messages: page, total, nextCursor, hasMore }
            }
        }

        // Offset-based fallback
        const sql = `SELECT * FROM customer_messages ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`
        const { results } = await this.db.prepare(sql).bind(...baseParams, limit, offset).all<CustomerMessage>()

        return { messages: results, total }
    }

    async getCustomerMessages(customerId: number, distributorId: number, role: string): Promise<CustomerMessage[]> {
        let sql = 'SELECT * FROM customer_messages WHERE customer_id = ?'
        const params: (string | number)[] = [customerId]

        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }

        sql += ' ORDER BY sent_at DESC LIMIT 100'

        const { results } = await this.db.prepare(sql).bind(...params).all<CustomerMessage>()
        return results
    }

    async sendMessage(data: {
        customerId: number
        templateId?: number
        type: string
        subject?: string
        content: string
        channel?: string
        relatedOrderId?: number
        distributorId: number
    }): Promise<CustomerMessage> {
        // Verify customer exists
        const customer = await this.db.prepare('SELECT id, name FROM customers WHERE id = ?')
            .bind(data.customerId).first<{ id: number; name: string }>()
        if (!customer) throw new Error('Customer not found')

        const { meta } = await this.db.prepare(
            `INSERT INTO customer_messages (customer_id, template_id, type, subject, content, channel, related_order_id, distributor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.customerId, data.templateId || null, data.type,
            data.subject || null, data.content, data.channel || 'EMAIL',
            data.relatedOrderId || null, data.distributorId
        ).run()

        return this.db.prepare('SELECT * FROM customer_messages WHERE id = ?')
            .bind(meta.last_row_id).first<CustomerMessage>() as Promise<CustomerMessage>
    }

    // ===== Triggers =====

    async listTriggers(distributorId: number, role: string): Promise<MessageTrigger[]> {
        let sql = 'SELECT mt.*, t.name as template_name FROM message_triggers mt LEFT JOIN message_templates t ON t.id = mt.template_id WHERE 1=1'
        const params: (string | number)[] = []

        if (role !== 'admin') {
            sql += ' AND mt.distributor_id = ?'
            params.push(distributorId)
        }

        sql += ' ORDER BY mt.event_type'

        const { results } = await this.db.prepare(sql).bind(...params).all<MessageTrigger>()
        return results
    }

    async createTrigger(data: {
        eventType: string
        templateId: number
        distributorId: number
    }): Promise<MessageTrigger> {
        const event = data.eventType.toUpperCase()
        if (!VALID_EVENTS.includes(event as typeof VALID_EVENTS[number])) {
            throw new Error(`Invalid event type: ${data.eventType}`)
        }

        // Verify template exists
        const template = await this.db.prepare('SELECT id FROM message_templates WHERE id = ?')
            .bind(data.templateId).first()
        if (!template) throw new Error('Template not found')

        const { meta } = await this.db.prepare(
            `INSERT INTO message_triggers (event_type, template_id, distributor_id)
             VALUES (?, ?, ?)`
        ).bind(event, data.templateId, data.distributorId).run()

        return this.db.prepare('SELECT * FROM message_triggers WHERE id = ?')
            .bind(meta.last_row_id).first<MessageTrigger>() as Promise<MessageTrigger>
    }

    async deleteTrigger(id: number, distributorId: number, role: string): Promise<boolean> {
        let sql = 'SELECT id FROM message_triggers WHERE id = ?'
        const params: (string | number)[] = [id]

        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }

        const existing = await this.db.prepare(sql).bind(...params).first()
        if (!existing) return false

        await this.db.prepare('DELETE FROM message_triggers WHERE id = ?').bind(id).run()
        return true
    }

    // ===== Auto-trigger on events =====

    async triggerOnEvent(eventType: string, orderId: number, distributorId: number): Promise<void> {
        try {
            const { results: triggers } = await this.db.prepare(
                'SELECT mt.*, t.body, t.subject, t.channel, t.type as template_type FROM message_triggers mt JOIN message_templates t ON t.id = mt.template_id WHERE mt.event_type = ? AND mt.distributor_id = ? AND mt.is_active = 1 AND t.is_active = 1'
            ).bind(eventType, distributorId).all()

            if (triggers.length === 0) return

            // Get order + customer info
            const order = await this.db.prepare(
                'SELECT o.*, c.name as customer_name, c.id as cust_id FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?'
            ).bind(orderId).first<any>()

            if (!order || !order.cust_id) return

            for (const trigger of triggers as any[]) {
                const content = this.resolveTemplate(trigger.body, {
                    order_id: String(orderId),
                    customer_name: order.customer_name || '',
                    total_amount: String(order.total_amount || 0),
                    status: order.status || '',
                    date: new Date().toISOString().slice(0, 10),
                    tracking_number: '',
                })

                const subject = trigger.subject
                    ? this.resolveTemplate(trigger.subject as string, { order_id: String(orderId) })
                    : undefined

                await this.sendMessage({
                    customerId: order.cust_id,
                    templateId: trigger.template_id as number,
                    type: trigger.template_type as string,
                    subject,
                    content,
                    channel: trigger.channel as string,
                    relatedOrderId: orderId,
                    distributorId,
                })
            }
        } catch (e) {
            console.error('[COMMUNICATION] triggerOnEvent failed:', e)
        }
    }

    private resolveTemplate(template: string, vars: Record<string, string>): string {
        let result = template
        for (const [key, value] of Object.entries(vars)) {
            // Escape regex metacharacters in key to prevent injection
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value)
        }
        return result
    }
}
