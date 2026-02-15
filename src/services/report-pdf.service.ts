import { PdfGenerator, PdfPage } from './pdf-generator'
import { FinancialReportsService } from './financial-reports.service'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_LEFT = 50
const MARGIN_RIGHT = 50
const MARGIN_TOP = 60
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

export class ReportPdfService {
    private financialService: FinancialReportsService

    constructor(private db: D1Database) {
        this.financialService = new FinancialReportsService(db)
    }

    /** 损益表 PDF */
    async generatePnlPdf(params: {
        startDate?: string
        endDate?: string
        distributorId: number
        role: string
    }): Promise<Uint8Array> {
        const pnl = await this.financialService.getPnL(params)
        const pdf = new PdfGenerator()
        const page = pdf.addPage()

        let y = PAGE_HEIGHT - MARGIN_TOP
        y = this.drawHeader(page, y, 'Profit & Loss Statement')
        y = this.drawSubHeader(page, y, `Period: ${pnl.period.start} ~ ${pnl.period.end}`)
        y -= 20

        // Table header
        y = this.drawTableHeader(page, y, ['Item', 'Amount (JPY)'])

        // Table rows
        const rows = [
            ['Revenue', this.formatAmount(pnl.revenue.total)],
            ['  Orders', String(pnl.revenue.orders)],
            ['  Tax', this.formatAmount(pnl.revenue.tax)],
            ['Cost of Goods Sold', `-${this.formatAmount(pnl.cogs)}`],
            ['Gross Profit', `${this.formatAmount(pnl.gross_profit)} (${pnl.gross_margin}%)`],
            ['Commission', `-${this.formatAmount(pnl.expenses.commission)}`],
            ['Refunds', `-${this.formatAmount(pnl.expenses.refunds)}`],
            ['Net Profit', `${this.formatAmount(pnl.net_profit)} (${pnl.net_margin}%)`],
        ]

        for (const [label, value] of rows) {
            const isBold = label === 'Gross Profit' || label === 'Net Profit'
            if (isBold) {
                page.drawRect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 16, 0.85)
                page.setGray(0)
            }
            y = this.drawTableRow(page, y, [label, value])
        }

        y -= 30
        this.drawFooter(page, 1)
        return pdf.generate()
    }

    /** 销售报告 PDF */
    async generateSalesPdf(params: {
        distributorId: number
        role: string
        period?: string
    }): Promise<Uint8Array> {
        // Get platform data
        const period = params.period || '30d'
        const isAdmin = params.role === 'admin'

        const days = period === '7d' ? 7 : period === '90d' ? 90 : 30

        const platformSql = isAdmin
            ? `SELECT platform, COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as revenue
               FROM orders WHERE created_at >= datetime('now', '-' || ? || ' days')
               GROUP BY platform ORDER BY revenue DESC`
            : `SELECT platform, COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as revenue
               FROM orders WHERE distributor_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
               GROUP BY platform ORDER BY revenue DESC`

        const stmt = isAdmin
            ? this.db.prepare(platformSql).bind(days)
            : this.db.prepare(platformSql).bind(params.distributorId, days)
        const { results: platforms } = await stmt.all<{ platform: string; order_count: number; revenue: number }>()

        // Get totals
        const totalOrders = platforms.reduce((s, r) => s + r.order_count, 0)
        const totalRevenue = platforms.reduce((s, r) => s + r.revenue, 0)

        const pdf = new PdfGenerator()
        const page = pdf.addPage()

        let y = PAGE_HEIGHT - MARGIN_TOP
        y = this.drawHeader(page, y, 'Sales Report')
        y = this.drawSubHeader(page, y, `Period: Last ${days} days`)
        y -= 10

        // Summary
        page.setFont('F1', 11)
        page.drawText(MARGIN_LEFT, y, `Total Orders: ${totalOrders}`)
        y -= 16
        page.drawText(MARGIN_LEFT, y, `Total Revenue: JPY ${totalRevenue.toLocaleString()}`)
        y -= 30

        // Platform breakdown table
        y = this.drawTableHeader(page, y, ['Platform', 'Orders', 'Revenue (JPY)', 'Share'])

        for (const p of platforms) {
            const pct = totalOrders > 0 ? Math.round((p.order_count / totalOrders) * 100) : 0
            y = this.drawTableRow(page, y, [
                p.platform,
                String(p.order_count),
                this.formatAmount(p.revenue),
                `${pct}%`,
            ])
        }

        // Total row
        page.drawRect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 16, 0.85)
        page.setGray(0)
        y = this.drawTableRow(page, y, [
            'TOTAL',
            String(totalOrders),
            this.formatAmount(totalRevenue),
            '100%',
        ])

        this.drawFooter(page, 1)
        return pdf.generate()
    }

    /** 库存报告 PDF */
    async generateInventoryPdf(params: {
        distributorId: number
        role: string
    }): Promise<Uint8Array> {
        const { results } = await this.db.prepare(`
            SELECT p.sku, p.name_cn as name, p.cost_price,
                COALESCE(wl.qty, 0) as stock,
                COALESCE(wl.qty, 0) * p.cost_price as value
            FROM products p
            LEFT JOIN warehouse_locations wl ON wl.sku = p.sku
            ORDER BY value DESC
            LIMIT 50
        `).all<{ sku: string; name: string; cost_price: number; stock: number; value: number }>()

        const totalValue = results.reduce((s, r) => s + (r.value || 0), 0)
        const totalUnits = results.reduce((s, r) => s + (r.stock || 0), 0)

        const pdf = new PdfGenerator()
        const page = pdf.addPage()

        let y = PAGE_HEIGHT - MARGIN_TOP
        y = this.drawHeader(page, y, 'Inventory Report')
        y = this.drawSubHeader(page, y, `Generated: ${new Date().toISOString().slice(0, 10)}`)
        y -= 10

        // Summary
        page.setFont('F1', 11)
        page.drawText(MARGIN_LEFT, y, `Total SKUs: ${results.length}`)
        y -= 16
        page.drawText(MARGIN_LEFT, y, `Total Units: ${totalUnits.toLocaleString()}`)
        y -= 16
        page.drawText(MARGIN_LEFT, y, `Total Value: JPY ${Math.round(totalValue).toLocaleString()}`)
        y -= 30

        // Table
        y = this.drawTableHeader(page, y, ['SKU', 'Stock', 'Cost', 'Value (JPY)'])

        for (const r of results) {
            if (y < 60) break // Avoid overflow
            y = this.drawTableRow(page, y, [
                r.sku,
                String(r.stock),
                this.formatAmount(r.cost_price),
                this.formatAmount(Math.round(r.value || 0)),
            ])
        }

        this.drawFooter(page, 1)
        return pdf.generate()
    }

    // --- Helper methods ---

    private drawHeader(page: PdfPage, y: number, title: string): number {
        page.setFont('F1', 18)
        page.drawText(MARGIN_LEFT, y, 'KeepDF ERP')
        y -= 24
        page.setFont('F1', 14)
        page.drawText(MARGIN_LEFT, y, title)
        y -= 4
        page.drawLine(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y, 1)
        y -= 16
        return y
    }

    private drawSubHeader(page: PdfPage, y: number, text: string): number {
        page.setFont('F1', 10)
        page.setGray(0.4)
        page.drawText(MARGIN_LEFT, y, text)
        page.setGray(0)
        y -= 16
        return y
    }

    private drawTableHeader(page: PdfPage, y: number, headers: string[]): number {
        page.drawRect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 16, 0.8)
        page.setGray(0)
        page.setFont('F1', 9)
        const colWidth = CONTENT_WIDTH / headers.length
        for (let i = 0; i < headers.length; i++) {
            page.drawText(MARGIN_LEFT + i * colWidth + 4, y, headers[i])
        }
        y -= 18
        return y
    }

    private drawTableRow(page: PdfPage, y: number, cells: string[]): number {
        page.setFont('F1', 9)
        const colWidth = CONTENT_WIDTH / cells.length
        for (let i = 0; i < cells.length; i++) {
            page.drawText(MARGIN_LEFT + i * colWidth + 4, y, cells[i])
        }
        y -= 16
        page.drawLine(MARGIN_LEFT, y + 2, PAGE_WIDTH - MARGIN_RIGHT, y + 2, 0.2)
        return y
    }

    private drawFooter(page: PdfPage, pageNum: number): void {
        page.setFont('F1', 8)
        page.setGray(0.5)
        page.drawText(MARGIN_LEFT, 30, `KeepDF ERP - Page ${pageNum}`)
        page.drawText(PAGE_WIDTH - MARGIN_RIGHT - 100, 30, new Date().toISOString().slice(0, 10))
        page.setGray(0)
    }

    private formatAmount(amount: number): string {
        return Math.round(amount).toLocaleString('en-US')
    }
}
