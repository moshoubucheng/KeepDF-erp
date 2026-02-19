import type { Bindings } from '../db/types'
import { PushService } from './push.service'

interface BriefingData {
    // Sales
    yesterdaySales: number
    dayBeforeSales: number
    yesterdayOrderCount: number
    // Platform breakdown
    platformSales: { platform: string; total: number; count: number }[]
    // Returns
    newReturns: number
    // Low stock
    lowStockItems: { sku: string; name: string; qty: number; days: number }[]
    // Pending approvals
    pendingPOs: number
    // Top product
    topProduct: { sku: string; name: string; qty: number } | null
    // New customers
    newCustomers: number
}

export class DailyBriefingService {
    constructor(
        private ai: Bindings['AI'],
        private db: D1Database,
        private pushService: PushService,
    ) {}

    /** Run the full daily briefing: gather data → AI summary → push to admins */
    async run(): Promise<{ sent: number; failed: number }> {
        // 1. Gather yesterday's business data
        const data = await this.gatherData()

        // 2. Generate AI summary
        const summary = await this.generateSummary(data)

        // 3. Push to all admin users
        const result = await this.pushToAdmins(summary)

        console.log(`[BRIEFING] Summary: ${summary.slice(0, 80)}...`)
        return result
    }

    private async gatherData(): Promise<BriefingData> {
        // Run all queries in parallel
        const [
            salesResult,
            dayBeforeResult,
            platformResult,
            returnsResult,
            lowStockResult,
            pendingPOsResult,
            topProductResult,
            newCustomersResult,
        ] = await Promise.all([
            // Yesterday's total sales & order count
            this.db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as cnt
                FROM orders
                WHERE date(created_at) = date('now', '-1 day')
            `).first<{ total: number; cnt: number }>(),

            // Day before yesterday (for comparison)
            this.db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM orders
                WHERE date(created_at) = date('now', '-2 days')
            `).first<{ total: number }>(),

            // Platform breakdown
            this.db.prepare(`
                SELECT platform, COALESCE(SUM(total_amount), 0) as total, COUNT(*) as cnt
                FROM orders
                WHERE date(created_at) = date('now', '-1 day')
                GROUP BY platform
                ORDER BY total DESC
            `).all<{ platform: string; total: number; cnt: number }>(),

            // New returns yesterday
            this.db.prepare(`
                SELECT COUNT(*) as cnt FROM returns
                WHERE date(created_at) = date('now', '-1 day')
            `).first<{ cnt: number }>(),

            // Low stock items (< 3 days of stock)
            this.db.prepare(`
                SELECT f.sku, COALESCE(p.name_jp, p.name_cn, p.sku) as name,
                       COALESCE(SUM(wl.qty), 0) as qty,
                       CAST(f.days_of_stock AS INTEGER) as days
                FROM inventory_forecast f
                JOIN products p ON p.sku = f.sku
                LEFT JOIN warehouse_locations wl ON wl.sku = f.sku
                WHERE f.days_of_stock < 3 AND f.days_of_stock >= 0
                GROUP BY f.sku
                ORDER BY f.days_of_stock ASC
                LIMIT 5
            `).all<{ sku: string; name: string; qty: number; days: number }>(),

            // Pending purchase orders
            this.db.prepare(`
                SELECT COUNT(*) as cnt FROM purchase_orders
                WHERE status IN ('DRAFT', 'SUBMITTED')
            `).first<{ cnt: number }>(),

            // Top selling product yesterday
            this.db.prepare(`
                SELECT oi.sku, COALESCE(p.name_jp, p.name_cn, oi.sku) as name, SUM(oi.qty) as qty
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                LEFT JOIN products p ON p.sku = oi.sku
                WHERE date(o.created_at) = date('now', '-1 day')
                GROUP BY oi.sku
                ORDER BY qty DESC
                LIMIT 1
            `).first<{ sku: string; name: string; qty: number }>(),

            // New customers yesterday
            this.db.prepare(`
                SELECT COUNT(*) as cnt FROM customers
                WHERE date(created_at) = date('now', '-1 day')
            `).first<{ cnt: number }>(),
        ])

        return {
            yesterdaySales: salesResult?.total ?? 0,
            dayBeforeSales: dayBeforeResult?.total ?? 0,
            yesterdayOrderCount: salesResult?.cnt ?? 0,
            platformSales: (platformResult?.results ?? []).map(r => ({
                platform: r.platform,
                total: r.total,
                count: r.cnt,
            })),
            newReturns: returnsResult?.cnt ?? 0,
            lowStockItems: lowStockResult?.results ?? [],
            pendingPOs: pendingPOsResult?.cnt ?? 0,
            topProduct: topProductResult ?? null,
            newCustomers: newCustomersResult?.cnt ?? 0,
        }
    }

    private async generateSummary(data: BriefingData): Promise<string> {
        const changeRate = data.dayBeforeSales > 0
            ? Math.round((data.yesterdaySales - data.dayBeforeSales) / data.dayBeforeSales * 100)
            : 0
        const changeSign = changeRate >= 0 ? '+' : ''

        const platformLines = data.platformSales
            .map(p => `${p.platform}: ¥${p.total.toLocaleString()} (${p.count}件)`)
            .join(', ')

        const lowStockLines = data.lowStockItems
            .map(i => `「${i.name}」残り${i.qty}個(${i.days}日分)`)
            .join(', ')

        const dataPrompt = `
昨日の業績データ:
- 売上合計: ¥${data.yesterdaySales.toLocaleString()} (前日比 ${changeSign}${changeRate}%)
- 注文数: ${data.yesterdayOrderCount}件
- プラットフォーム別: ${platformLines || 'なし'}
- 新規顧客: ${data.newCustomers}名
- 売上トップ商品: ${data.topProduct ? `「${data.topProduct.name}」${data.topProduct.qty}個` : 'なし'}
- 新規返品: ${data.newReturns}件
- 在庫警告(3日以内): ${lowStockLines || 'なし'}
- 未処理の発注書: ${data.pendingPOs}件
`.trim()

        const messages: { role: 'system' | 'user'; content: string }[] = [
            {
                role: 'system',
                content: `あなたはKeepDF ERPの専属秘書AIです。毎朝、社長に昨日の業績サマリーを報告します。

ルール:
1. 日本語で、200文字以内の簡潔なレポートを書く
2. 「おはようございます！」で始める
3. 重要な数字を強調する
4. リスクや注意点があれば警告する
5. 具体的なアクション提案を1〜2個含める
6. 絵文字を適度に使う（📊💰⚠️📦など）
7. テキストのみで出力（JSON不要、マークダウン不要）`,
            },
            {
                role: 'user',
                content: dataPrompt,
            },
        ]

        const aiResponse = await this.ai.run(
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            { messages, max_tokens: 300, temperature: 0.7 },
        )

        // Extract text from response
        const raw = aiResponse as Record<string, unknown>
        if (typeof aiResponse === 'string') return aiResponse.trim()
        if (raw && typeof raw === 'object' && 'response' in raw) {
            const inner = raw.response
            if (typeof inner === 'string') return inner.trim()
        }

        // Fallback: generate a simple summary without AI
        return `おはようございます！📊 昨日の売上: ¥${data.yesterdaySales.toLocaleString()} (${changeSign}${changeRate}%)、注文${data.yesterdayOrderCount}件。${data.lowStockItems.length > 0 ? `⚠️ 在庫警告: ${data.lowStockItems.length}商品が3日以内に在庫切れ。` : ''}${data.pendingPOs > 0 ? `📦 未処理発注書: ${data.pendingPOs}件。` : ''}`
    }

    private async pushToAdmins(summary: string): Promise<{ sent: number; failed: number }> {
        // Find all admin users
        const { results: admins } = await this.db.prepare(
            `SELECT id FROM distributors WHERE role = 'admin'`,
        ).all<{ id: number }>()

        let totalSent = 0
        let totalFailed = 0

        for (const admin of admins) {
            try {
                const result = await this.pushService.sendToDistributor(admin.id, {
                    title: '📋 KeepDF 日報',
                    body: summary,
                    url: '/dashboard',
                    tag: 'daily-briefing',
                })
                totalSent += result.sent
                totalFailed += result.failed
            } catch (e) {
                console.error(`[BRIEFING] Failed to push to admin ${admin.id}:`, e)
                totalFailed++
            }
        }

        return { sent: totalSent, failed: totalFailed }
    }
}
