import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { AiService } from '../services/ai.service'

const ai = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** POST /ai/chat — Natural language data query */
ai.post('/chat', async (c) => {
    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const body = await c.req.json<{ message?: string; history?: { role: string; content: string }[] }>()

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
        return c.json({ error: 'Message is required' }, 400)
    }

    if (body.message.length > 500) {
        return c.json({ error: 'Message too long (max 500 characters)' }, 400)
    }

    const aiService = new AiService(c.env.AI, c.env.DB, c.env.KV)

    // Rate limiting
    const allowed = await aiService.checkRateLimit(distributorId)
    if (!allowed) {
        return c.json({ error: 'Rate limit exceeded. Please wait a minute.' }, 429)
    }

    try {
        const result = await aiService.chat(body.message.trim(), role, distributorId, body.history)

        // Audit log
        try {
            await c.env.DB.prepare(
                `INSERT INTO audit_logs (distributor_id, action, resource_type, resource_id, details, ip_address, created_at)
                 VALUES (?, 'AI_CHAT', 'ai', NULL, ?, ?, datetime('now'))`,
            ).bind(
                distributorId,
                JSON.stringify({ message: body.message.slice(0, 100), hasSql: !!result.sql }),
                c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
            ).run()
        } catch {
            // Audit log failure should not block response
        }

        return c.json({ success: true, ...result })
    } catch (err) {
        const errDetail = err instanceof Error ? err.message : String(err)
        console.error('[AI] Chat error:', errDetail, err instanceof Error ? err.stack : '')
        return c.json({ error: `AI service error: ${errDetail}` }, 503)
    }
})

export { ai }
