import type { Bindings } from '../db/types'

// Tables the AI is allowed to query
const ALLOWED_TABLES = [
    'orders', 'order_items', 'products', 'product_variants',
    'customers', 'warehouse_locations', 'commission_settlements',
    'shipments', 'returns', 'return_items', 'purchase_orders',
    'purchase_order_items', 'wallet_transactions', 'coupons',
    'price_rules', 'suppliers', 'inventory_forecast',
    'shipment_events', 'exchange_rates',
]

// SQL keywords that are forbidden (data-modifying)
const FORBIDDEN_PATTERNS = [
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE)\b/i,
    /\b(GRANT|REVOKE|EXEC|EXECUTE|ATTACH|DETACH)\b/i,
    /\bPRAGMA\b/i,
    /;\s*\S/,  // multiple statements
]

const MAX_SQL_LENGTH = 1000
const MAX_RESULT_ROWS = 100

function buildSchemaContext(): string {
    return `
Available tables and columns:

orders (id, platform TEXT ['TIKTOK','TEMU','RAKUTEN'], platform_order_id TEXT, status TEXT ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED'], total_amount INTEGER, tax_total INTEGER, distributor_id INTEGER, created_at TEXT, delivered_at TEXT, cancelled_at TEXT, customer_id INTEGER, currency TEXT, discount_amount INTEGER)

order_items (id, order_id INTEGER, sku TEXT, qty INTEGER, unit_price INTEGER, tax_rate REAL)

products (id, sku TEXT UNIQUE, name_cn TEXT, name_jp TEXT, cost_price INTEGER, tax_category TEXT ['standard','reduced'], image_url TEXT, barcode TEXT)

product_variants (id, product_id INTEGER, color TEXT, size TEXT, sku TEXT, stock_qty INTEGER)

warehouse_locations (id, code TEXT, sku TEXT, qty INTEGER)

customers (id, name TEXT, email TEXT, phone TEXT, address_line1 TEXT, city TEXT, prefecture TEXT, postal_code TEXT, country TEXT, platform TEXT, platform_customer_id TEXT, tags TEXT, notes TEXT, distributor_id INTEGER, created_at TEXT)

commission_settlements (id, distributor_id INTEGER, order_id INTEGER, sku TEXT, platform TEXT, qty INTEGER, unit_price INTEGER, commission_rate REAL, commission_amount INTEGER, status TEXT ['PENDING','SETTLED','FAILED'], settled_at TEXT, created_at TEXT)

shipments (id, order_id INTEGER, tracking_number TEXT, carrier TEXT ['YAMATO','SAGAWA','JAPAN_POST','FEDEX','DHL','OTHER'], status TEXT ['SHIPPED','IN_TRANSIT','DELIVERED','RETURNED'], shipped_at TEXT, estimated_delivery TEXT, actual_delivery TEXT, distributor_id INTEGER, created_at TEXT)

shipment_events (id, shipment_id INTEGER, status TEXT, location TEXT, description TEXT, event_time TEXT)

returns (id, order_id INTEGER, shipment_id INTEGER, distributor_id INTEGER, status TEXT ['REQUESTED','APPROVED','RECEIVED','REFUNDED','REJECTED'], reason TEXT, refund_type TEXT ['FULL','PARTIAL'], refund_amount INTEGER, created_at TEXT, updated_at TEXT)

return_items (id, return_id INTEGER, sku TEXT, qty INTEGER, unit_price INTEGER, reason TEXT)

purchase_orders (id, po_number TEXT, supplier_id INTEGER, status TEXT ['DRAFT','SUBMITTED','CONFIRMED','SHIPPED','RECEIVED','CLOSED'], total_amount INTEGER, notes TEXT, expected_delivery TEXT, received_at TEXT, created_by INTEGER, created_at TEXT)

purchase_order_items (id, po_id INTEGER, sku TEXT, qty INTEGER, unit_cost INTEGER, received_qty INTEGER)

wallet_transactions (id, distributor_id INTEGER, type TEXT ['DEPOSIT','FREEZE','DEDUCT','REFUND'], amount INTEGER, related_order_id TEXT, balance_snapshot INTEGER, created_at TEXT)

coupons (id, code TEXT, name TEXT, type TEXT ['PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING'], value INTEGER, min_order_amount INTEGER, usage_limit INTEGER, usage_count INTEGER, valid_from TEXT, valid_to TEXT, is_active INTEGER, created_by INTEGER)

price_rules (id, sku TEXT, platform TEXT, base_price INTEGER, sale_price INTEGER, valid_from TEXT, valid_to TEXT, is_active INTEGER)

suppliers (id, name TEXT, contact_name TEXT, contact_email TEXT, lead_time_days INTEGER, is_active INTEGER)

inventory_forecast (id, sku TEXT, daily_velocity REAL, weekly_velocity REAL, days_of_stock REAL, reorder_point INTEGER, safety_stock INTEGER, lead_time_days INTEGER, calculated_at TEXT)

exchange_rates (id, from_currency TEXT, to_currency TEXT, rate REAL, source TEXT)
`.trim()
}

function buildSystemPrompt(role: string, distributorId: number): string {
    const schema = buildSchemaContext()
    const isolation = role === 'admin'
        ? 'The user is an admin. They can query all data without restrictions.'
        : `The user is a distributor (distributor_id = ${distributorId}). ALL queries MUST include "WHERE distributor_id = ${distributorId}" (or equivalent JOIN condition) to ensure data isolation. Tables with distributor_id: orders, customers, commission_settlements, shipments, returns, wallet_transactions, purchase_orders (created_by).`

    return `You are KeepDF ERP data analysis assistant. You help users query their business data using natural language.

${schema}

RULES:
1. You can ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, or any data modification.
2. ${isolation}
3. All monetary values are stored as integers in JPY (Japanese Yen). Display them as-is (no division needed).
4. Dates are stored as ISO 8601 TEXT (e.g., '2025-01-15T10:30:00Z'). Use date() or strftime() for date comparisons.
5. For "this week", use date('now', 'weekday 0', '-6 days') to date('now'). For "this month", use date('now', 'start of month').
6. For "last month", use date('now', 'start of month', '-1 month') to date('now', 'start of month').
7. Always add LIMIT 100 unless the user specifies otherwise.
8. When counting or aggregating, always use appropriate GROUP BY.
9. Respond in the SAME LANGUAGE as the user's question.

OUTPUT FORMAT:
- If the question requires a database query, respond with EXACTLY this JSON (no markdown, no code fences):
{"sql": "SELECT ...", "explanation": "Brief explanation of what the query does"}
- If the question is general (greeting, help, etc.) and does NOT need a query, respond with:
{"answer": "Your helpful response here"}

EXAMPLES:
User: 今月の注文数は？
{"sql": "SELECT COUNT(*) as order_count FROM orders WHERE created_at >= date('now', 'start of month')", "explanation": "今月の注文数を集計します"}

User: 在庫が少ない商品トップ5
{"sql": "SELECT p.sku, p.name_jp, COALESCE(SUM(wl.qty), 0) as total_stock FROM products p LEFT JOIN warehouse_locations wl ON p.sku = wl.sku GROUP BY p.sku ORDER BY total_stock ASC LIMIT 5", "explanation": "在庫数が最も少ない商品を5件表示します"}

User: プラットフォーム別の売上
{"sql": "SELECT platform, COUNT(*) as order_count, SUM(total_amount) as total_sales FROM orders GROUP BY platform ORDER BY total_sales DESC", "explanation": "プラットフォーム別に注文数と売上合計を集計します"}

User: こんにちは
{"answer": "こんにちは！KeepDF ERPのデータについて何でも質問してください。注文、在庫、顧客データなどを自然言語で検索できます。"}`
}

export interface AiChatRequest {
    message: string
    history?: { role: string; content: string }[]
}

export interface AiChatResponse {
    reply: string
    data?: { columns: string[]; rows: unknown[][] }
    sql?: string
}

interface AiSqlResponse {
    sql: string
    explanation: string
}

interface AiTextResponse {
    answer: string
}

export class AiService {
    constructor(
        private ai: Bindings['AI'],
        private db: D1Database,
        private kv: KVNamespace,
    ) {}

    /** Rate limit: 10 requests per minute per distributor */
    async checkRateLimit(distributorId: number): Promise<boolean> {
        const key = `ai_rate:${distributorId}`
        const current = await this.kv.get(key)
        const count = current ? parseInt(current, 10) : 0
        if (count >= 10) return false
        await this.kv.put(key, String(count + 1), { expirationTtl: 60 })
        return true
    }

    /** Validate that SQL is safe (SELECT only, allowed tables) */
    validateSQL(sql: string): { valid: boolean; error?: string } {
        if (sql.length > MAX_SQL_LENGTH) {
            return { valid: false, error: 'Query too long' }
        }

        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(sql)) {
                return { valid: false, error: 'Only SELECT queries are allowed' }
            }
        }

        if (!/^\s*SELECT\b/i.test(sql)) {
            return { valid: false, error: 'Only SELECT queries are allowed' }
        }

        // Extract table names from query and verify they're in the whitelist
        const tablePattern = /\b(?:FROM|JOIN)\s+(\w+)/gi
        let match
        while ((match = tablePattern.exec(sql)) !== null) {
            const table = match[1].toLowerCase()
            if (!ALLOWED_TABLES.includes(table)) {
                return { valid: false, error: `Table "${match[1]}" is not accessible` }
            }
        }

        return { valid: true }
    }

    /** Call Workers AI and process the response */
    async chat(
        message: string,
        role: string,
        distributorId: number,
        history?: { role: string; content: string }[],
    ): Promise<AiChatResponse> {
        const systemPrompt = buildSystemPrompt(role, distributorId)

        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt },
        ]

        // Add conversation history (last 10 messages max)
        if (history?.length) {
            const recent = history.slice(-10)
            for (const msg of recent) {
                messages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content,
                })
            }
        }

        messages.push({ role: 'user', content: message })

        // Call Workers AI
        const aiResponse = await this.ai.run(
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            { messages, max_tokens: 512, temperature: 0.1 },
        )

        // Extract response content from Workers AI
        // Response shape: string | { response: string | object, tool_calls?, usage? }
        let parsed: AiSqlResponse | AiTextResponse | null = null
        const raw = aiResponse as Record<string, unknown>

        if (typeof aiResponse === 'string') {
            // Direct string response
            try {
                const cleaned = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
                parsed = JSON.parse(cleaned)
            } catch {
                return { reply: aiResponse.trim() || 'No response from AI model.' }
            }
        } else if (raw && typeof raw === 'object' && 'response' in raw) {
            const inner = raw.response
            if (typeof inner === 'string') {
                // response is a JSON string
                try {
                    const cleaned = inner.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
                    parsed = JSON.parse(cleaned)
                } catch {
                    return { reply: inner.trim() || 'No response from AI model.' }
                }
            } else if (inner && typeof inner === 'object') {
                // response is already a parsed object
                parsed = inner as AiSqlResponse | AiTextResponse
            }
        }

        if (!parsed) {
            return { reply: 'No response from AI model.' }
        }

        // Text-only answer (no SQL needed)
        if ('answer' in parsed) {
            return { reply: (parsed as AiTextResponse).answer }
        }

        // SQL query response
        if ('sql' in parsed) {
            const { sql, explanation } = parsed as AiSqlResponse

            // Validate SQL
            const validation = this.validateSQL(sql)
            if (!validation.valid) {
                return { reply: `${explanation}\n\n(Query blocked: ${validation.error})` }
            }

            // Enforce data isolation for distributors
            if (role === 'distributor') {
                const sqlLower = sql.toLowerCase()
                const distributorTables = ['orders', 'customers', 'commission_settlements', 'shipments', 'returns', 'wallet_transactions']
                const hasDistributorTable = distributorTables.some(t => sqlLower.includes(t))
                if (hasDistributorTable && !sqlLower.includes('distributor_id')) {
                    return { reply: `${explanation}\n\n(Query blocked: data isolation violation)` }
                }
            }

            // Execute query
            try {
                const result = await this.db
                    .prepare(sql)
                    .all()

                const rows = (result.results || []).slice(0, MAX_RESULT_ROWS)
                const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []
                const dataRows = rows.map(row =>
                    columns.map(col => (row as Record<string, unknown>)[col]),
                )

                return {
                    reply: explanation,
                    data: { columns, rows: dataRows },
                    sql,
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'
                return { reply: `${explanation}\n\n(SQL execution error: ${errMsg})` }
            }
        }

        return { reply: JSON.stringify(parsed) }
    }
}
