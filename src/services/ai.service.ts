import type { Bindings } from '../db/types'

// Tables the AI is allowed to query
const ALLOWED_TABLES = [
    'orders', 'order_items', 'products', 'product_variants',
    'customers', 'warehouse_locations', 'commission_settlements',
    'shipments', 'returns', 'return_items', 'purchase_orders',
    'purchase_order_items', 'wallet_transactions', 'coupons',
    'price_rules', 'suppliers', 'inventory_forecasts',
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

inventory_forecasts (id, sku TEXT, daily_velocity REAL, weekly_velocity REAL, days_of_stock REAL, reorder_point INTEGER, safety_stock INTEGER, lead_time_days INTEGER, calculated_at TEXT)

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
4. Dates are stored as UTC TEXT. IMPORTANT: All date comparisons must use JST (UTC+9). Always add '+9 hours' modifier: date(created_at, '+9 hours') and date('now', '+9 hours', ...).
5. For "this week", use date('now', '+9 hours', 'weekday 0', '-6 days') to date('now', '+9 hours'). For "this month", use date('now', '+9 hours', 'start of month').
6. For "last month", use date('now', '+9 hours', 'start of month', '-1 month') to date('now', '+9 hours', 'start of month').
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
{"sql": "SELECT COUNT(*) as order_count FROM orders WHERE date(created_at, '+9 hours') >= date('now', '+9 hours', 'start of month')", "explanation": "今月の注文数を集計します"}

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
        // Catches FROM/JOIN and comma-separated tables (FROM t1, t2, t3)
        const tablePattern = /\b(?:FROM|JOIN)\s+(\w+)/gi
        let match
        while ((match = tablePattern.exec(sql)) !== null) {
            const table = match[1].toLowerCase()
            if (!ALLOWED_TABLES.includes(table)) {
                return { valid: false, error: `Table "${match[1]}" is not accessible` }
            }
        }

        // Block sensitive tables that could appear via comma-joins or other syntax
        const SENSITIVE_TABLES = ['distributors', 'api_logs', 'push_subscriptions', 'audit_logs']
        for (const table of SENSITIVE_TABLES) {
            if (new RegExp(`\\b${table}\\b`, 'i').test(sql)) {
                return { valid: false, error: `Table "${table}" is not accessible` }
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

    /** AI-powered replenishment forecast */
    async forecast(): Promise<AiForecastResponse> {
        // 1. Gather 3 months of monthly sales per SKU
        const { results: monthlySales } = await this.db.prepare(`
            SELECT oi.sku,
                   COALESCE(p.name_jp, p.name_cn, oi.sku) as name,
                   strftime('%Y-%m', o.created_at) as month,
                   SUM(oi.qty) as qty,
                   SUM(oi.qty * oi.unit_price) as revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.sku = oi.sku
            WHERE o.status IN ('SHIPPED','DELIVERED')
              AND o.created_at >= date('now', '-3 months')
            GROUP BY oi.sku, month
            ORDER BY oi.sku, month
        `).all<{ sku: string; name: string; month: string; qty: number; revenue: number }>()

        // 2. Current stock & forecast data
        const { results: stockData } = await this.db.prepare(`
            SELECT p.sku,
                   COALESCE(p.name_jp, p.name_cn, p.sku) as name,
                   p.cost_price,
                   COALESCE(w.total_stock, 0) as current_stock,
                   COALESCE(f.daily_velocity, 0) as daily_velocity,
                   COALESCE(f.days_of_stock, 9999) as days_of_stock,
                   COALESCE(f.reorder_point, 0) as reorder_point,
                   COALESCE(f.lead_time_days, 7) as lead_time_days
            FROM products p
            LEFT JOIN (SELECT sku, SUM(qty) as total_stock FROM warehouse_locations GROUP BY sku) w ON w.sku = p.sku
            LEFT JOIN inventory_forecasts f ON f.sku = p.sku
            WHERE COALESCE(w.total_stock, 0) > 0 OR COALESCE(f.daily_velocity, 0) > 0
            ORDER BY COALESCE(f.days_of_stock, 9999) ASC
            LIMIT 30
        `).all<{
            sku: string; name: string; cost_price: number; current_stock: number;
            daily_velocity: number; days_of_stock: number; reorder_point: number; lead_time_days: number
        }>()

        // 3. Pending purchase orders
        const { results: pendingPOs } = await this.db.prepare(`
            SELECT poi.sku, SUM(poi.qty - poi.received_qty) as incoming_qty
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.po_id
            WHERE po.status IN ('SUBMITTED','CONFIRMED','SHIPPED')
            GROUP BY poi.sku
        `).all<{ sku: string; incoming_qty: number }>()

        const pendingMap = new Map(pendingPOs.map(p => [p.sku, p.incoming_qty]))

        // 4. Build data summary for AI
        const skuMap = new Map<string, {
            name: string; cost: number; stock: number; velocity: number;
            daysLeft: number; reorderPt: number; leadTime: number; incoming: number;
            sales: { month: string; qty: number }[]
        }>()

        for (const s of stockData) {
            skuMap.set(s.sku, {
                name: s.name, cost: s.cost_price, stock: s.current_stock,
                velocity: s.daily_velocity, daysLeft: s.days_of_stock,
                reorderPt: s.reorder_point, leadTime: s.lead_time_days,
                incoming: pendingMap.get(s.sku) || 0,
                sales: [],
            })
        }

        for (const ms of monthlySales) {
            const entry = skuMap.get(ms.sku)
            if (entry) {
                entry.sales.push({ month: ms.month, qty: ms.qty })
            }
        }

        // Build text for AI (top 20 items needing attention)
        const items = Array.from(skuMap.entries())
            .slice(0, 20)
            .map(([sku, d]) => {
                const salesStr = d.sales.map(s => `${s.month}: ${s.qty}個`).join(', ')
                return `- ${sku}「${d.name}」: 在庫${d.stock}個, 日販${d.velocity.toFixed(1)}個, 残り${Math.round(d.daysLeft)}日, 発注点${d.reorderPt}, リードタイム${d.leadTime}日, 入荷予定${d.incoming}個, 原価¥${d.cost}, 月別販売[${salesStr || 'データなし'}]`
            })
            .join('\n')

        const currentMonth = new Date().getMonth() + 1
        const season = currentMonth >= 3 && currentMonth <= 5 ? '春'
            : currentMonth >= 6 && currentMonth <= 8 ? '夏'
            : currentMonth >= 9 && currentMonth <= 11 ? '秋' : '冬'

        const dataPrompt = `現在は${new Date().toISOString().slice(0, 10)}、${season}です。

以下は在庫が少ない順に並べた商品データ（過去3ヶ月の月別販売実績 + 現在の在庫状況）：

${items}

上記データに基づいて、各商品の補充提案を行ってください。`

        // 5. Call AI
        const messages: { role: 'system' | 'user'; content: string }[] = [
            {
                role: 'system',
                content: `あなたはKeepDF ERPの在庫分析AIです。過去の販売データ、現在庫、季節要因を分析し、具体的な補充提案を行います。

ルール:
1. JSON配列で出力する（マークダウン不要、コードフェンス不要）
2. 各要素は: {"sku": "...", "action": "発注" or "様子見", "qty": 数値, "reason": "理由（50文字以内）", "urgency": "high" or "medium" or "low"}
3. 販売トレンド（増加/減少/安定）を分析する
4. 季節要因を考慮する（例: 夏は飲料が増える）
5. 入荷予定がある場合はそれも考慮する
6. 在庫日数が7日以下は urgency: "high"
7. 最大15商品まで`,
            },
            { role: 'user', content: dataPrompt },
        ]

        const aiResponse = await this.ai.run(
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            { messages, max_tokens: 1024, temperature: 0.3 },
        )

        // Parse response
        const raw = aiResponse as Record<string, unknown>
        let responseContent: unknown = null
        if (typeof aiResponse === 'string') {
            responseContent = aiResponse
        } else if (raw && typeof raw === 'object' && 'response' in raw) {
            responseContent = raw.response
        }

        let suggestions: AiForecastItem[] = []
        try {
            if (typeof responseContent === 'string') {
                const cleaned = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
                suggestions = JSON.parse(cleaned)
            } else if (Array.isArray(responseContent)) {
                suggestions = responseContent as AiForecastItem[]
            } else if (responseContent && typeof responseContent === 'object') {
                // Might be wrapped in an object
                const obj = responseContent as Record<string, unknown>
                if (Array.isArray(obj)) {
                    suggestions = obj as unknown as AiForecastItem[]
                } else {
                    suggestions = [responseContent as AiForecastItem]
                }
            }
        } catch {
            // If parsing fails, return raw as summary
            return {
                suggestions: [],
                summary: typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent),
                generatedAt: new Date().toISOString(),
            }
        }

        // Enrich suggestions with current stock data
        const enriched = (Array.isArray(suggestions) ? suggestions : []).map(s => {
            const data = skuMap.get(s.sku)
            return {
                ...s,
                name: data?.name || s.sku,
                currentStock: data?.stock ?? 0,
                daysOfStock: data ? Math.round(data.daysLeft) : 0,
                dailyVelocity: data?.velocity ?? 0,
                incoming: data?.incoming ?? 0,
            }
        })

        return {
            suggestions: enriched,
            summary: '',
            generatedAt: new Date().toISOString(),
        }
    }
}

export interface AiForecastItem {
    sku: string
    name?: string
    action: string
    qty: number
    reason: string
    urgency: 'high' | 'medium' | 'low'
    currentStock?: number
    daysOfStock?: number
    dailyVelocity?: number
    incoming?: number
}

export interface AiForecastResponse {
    suggestions: AiForecastItem[]
    summary: string
    generatedAt: string
}
