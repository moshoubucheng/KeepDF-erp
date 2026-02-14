import { PdfGenerator } from './pdf-generator'
import type { Invoice } from '../db/types'

export class InvoicePdfService {
    constructor(
        private db: D1Database,
        private bucket: R2Bucket,
    ) {}

    /** Generate PDF for an invoice, store in R2, update DB */
    async generatePdf(invoiceId: number, distributorId: number): Promise<{ pdf_url: string }> {
        // 1. Get invoice + verify ownership
        const invoice = await this.db.prepare(`
            SELECT i.*, o.distributor_id, o.platform, o.platform_order_id, o.total_amount
            FROM invoices i
            JOIN orders o ON o.id = i.order_id
            WHERE i.id = ?
        `).bind(invoiceId).first<Invoice & { distributor_id: number; platform: string; platform_order_id: string; total_amount: number }>()

        if (!invoice) throw new Error('Invoice not found')
        if (invoice.distributor_id !== distributorId) throw new Error('Forbidden')
        if (invoice.pdf_url) throw new Error('PDF already generated')

        // 2. Parse tax_details
        const taxDetails = JSON.parse(invoice.tax_details || '{}')

        // 3. Build PDF
        const pdf = new PdfGenerator()
        const page = pdf.addPage()

        // Title
        page.setFont('F2', 18)
        page.drawText(50, 780, taxDetails.invoiceType || '\u9069\u683C\u8ACB\u6C42\u66F8', true)

        // Invoice number & date
        page.setFont('F1', 10)
        page.drawText(400, 780, `No: ${invoice.invoice_number || ''}`)
        page.drawText(400, 765, `Date: ${taxDetails.date || ''}`)

        // Separator line
        page.drawLine(50, 755, 545, 755, 1)

        // Seller info
        page.setFont('F2', 9)
        page.drawText(50, 735, '\u8CA9\u58F2\u8005:', true) // 販売者:
        page.setFont('F2', 10)
        page.drawText(100, 735, taxDetails.seller?.name || '', true)
        page.setFont('F1', 9)
        page.drawText(100, 720, `T${taxDetails.seller?.registrationNumber || ''}`)

        // Buyer info
        page.setFont('F2', 9)
        page.drawText(350, 735, '\u8CFC\u5165\u8005:', true) // 購入者:
        page.setFont('F2', 10)
        page.drawText(400, 735, taxDetails.buyer || '', true)

        // Items table header
        const tableTop = 690
        page.drawRect(50, tableTop - 2, 495, 16, 0.85)
        page.setFont('F2', 8)
        page.setGray(0)
        page.drawText(55, tableTop, '\u54C1\u540D', true)       // 品名
        page.drawText(250, tableTop, '\u6570\u91CF', true)      // 数量
        page.drawText(310, tableTop, '\u5358\u4FA1', true)      // 単価
        page.drawText(380, tableTop, '\u7A0E\u7387', true)      // 税率
        page.drawText(430, tableTop, '\u7A0E\u984D', true)      // 税額
        page.drawText(490, tableTop, '\u5408\u8A08', true)      // 合計

        // Items rows
        const items = taxDetails.items || []
        let y = tableTop - 20
        page.setFont('F2', 9)
        for (const item of items) {
            page.drawText(55, y, item.name || item.sku || '', true)
            page.setFont('F1', 9)
            page.drawText(255, y, `${item.qty}`)
            page.drawText(310, y, `${(item.unitPrice || 0).toLocaleString()}`)
            page.drawText(380, y, `${((item.taxRate || 0) * 100).toFixed(0)}%`)
            page.drawText(430, y, `${(item.taxAmount || 0).toLocaleString()}`)
            page.drawText(490, y, `${(item.total || 0).toLocaleString()}`)
            page.setFont('F2', 9)
            y -= 18
        }

        // Summary separator
        page.drawLine(50, y - 5, 545, y - 5, 0.5)
        y -= 25

        // Tax summary
        const summary = taxDetails.summary || {}
        page.setFont('F2', 9)
        if (summary.subtotal10 > 0) {
            page.drawText(300, y, '10%\u5BFE\u8C61:', true) // 10%対象:
            page.setFont('F1', 9)
            page.drawText(430, y, `${summary.subtotal10?.toLocaleString() || 0}`)
            page.drawText(480, y, `(tax: ${summary.tax10?.toLocaleString() || 0})`)
            y -= 16
        }
        page.setFont('F2', 9)
        if (summary.subtotal8 > 0) {
            page.drawText(300, y, '8%\u5BFE\u8C61:', true)  // 8%対象:
            page.setFont('F1', 9)
            page.drawText(430, y, `${summary.subtotal8?.toLocaleString() || 0}`)
            page.drawText(480, y, `(tax: ${summary.tax8?.toLocaleString() || 0})`)
            y -= 16
        }

        // Grand total
        y -= 10
        page.drawLine(300, y + 5, 545, y + 5, 1)
        page.setFont('F2', 12)
        page.drawText(300, y - 10, '\u5408\u8A08 (\u7A0E\u8FBC):', true) // 合計 (税込):
        page.setFont('F1', 14)
        page.drawText(450, y - 10, `${(summary.grandTotal || 0).toLocaleString()}`)

        // Generate binary
        const pdfBytes = pdf.generate()

        // 4. Store in R2
        const r2Path = `invoices/${invoice.invoice_number}.pdf`
        await this.bucket.put(r2Path, pdfBytes, {
            httpMetadata: { contentType: 'application/pdf' },
        })

        // 5. Update DB
        await this.db.prepare('UPDATE invoices SET pdf_url = ? WHERE id = ?')
            .bind(r2Path, invoiceId).run()

        return { pdf_url: r2Path }
    }

    /** Get PDF from R2 for streaming download */
    async getPdf(invoiceId: number, distributorId: number): Promise<R2ObjectBody | null> {
        // Verify ownership
        const invoice = await this.db.prepare(`
            SELECT i.pdf_url, o.distributor_id
            FROM invoices i
            JOIN orders o ON o.id = i.order_id
            WHERE i.id = ?
        `).bind(invoiceId).first<{ pdf_url: string | null; distributor_id: number }>()

        if (!invoice) throw new Error('Invoice not found')
        if (invoice.distributor_id !== distributorId) throw new Error('Forbidden')
        if (!invoice.pdf_url) return null

        const obj = await this.bucket.get(invoice.pdf_url)
        return obj
    }
}
