import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { InvoiceService } from '../services/invoice.service'
import { InvoicePdfService } from '../services/invoice-pdf.service'
import { AuditService } from '../services/audit.service'
import { toCSV, csvResponse } from '../utils/csv'

const invoices = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /invoices/export - CSV 导出 */
invoices.get('/export', async (c) => {
    const distributorId = c.get('distributorId')

    const { results } = await c.env.DB.prepare(`
        SELECT i.id, i.invoice_number, i.order_id, o.platform, o.total_amount, i.created_at
        FROM invoices i
        JOIN orders o ON o.id = i.order_id
        WHERE o.distributor_id = ?
        ORDER BY i.created_at DESC
        LIMIT 5000
    `).bind(distributorId).all()

    const csv = toCSV(results as Record<string, unknown>[], [
        { key: 'id', header: 'ID' },
        { key: 'invoice_number', header: 'Invoice Number' },
        { key: 'order_id', header: 'Order ID' },
        { key: 'platform', header: 'Platform' },
        { key: 'total_amount', header: 'Amount' },
        { key: 'created_at', header: 'Issue Date' },
    ])

    return csvResponse(csv, 'invoices.csv')
})

/** POST /invoices/:id/pdf - Generate PDF */
invoices.post('/:id/pdf', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    const pdfService = new InvoicePdfService(c.env.DB, c.env.BUCKET)
    try {
        const result = await pdfService.generatePdf(id, distributorId)

        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId,
            action: 'GENERATE_PDF',
            resourceType: 'invoice',
            resourceId: String(id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({ success: true, pdf_url: result.pdf_url }, 201)
    } catch (e: any) {
        if (e.message === 'Invoice not found') return c.json({ error: e.message }, 404)
        if (e.message === 'Forbidden') return c.json({ error: 'Invoice does not belong to you' }, 403)
        if (e.message === 'PDF already generated') return c.json({ error: e.message }, 409)
        return c.json({ error: e.message }, 500)
    }
})

/** GET /invoices/:id/pdf - Download PDF */
invoices.get('/:id/pdf', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    const pdfService = new InvoicePdfService(c.env.DB, c.env.BUCKET)
    try {
        const pdfBody = await pdfService.getPdf(id, distributorId)
        if (!pdfBody) return c.json({ error: 'PDF not found' }, 404)

        return new Response(pdfBody.body, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
            },
        })
    } catch (e: any) {
        if (e.message === 'Invoice not found') return c.json({ error: e.message }, 404)
        if (e.message === 'Forbidden') return c.json({ error: 'Invoice does not belong to you' }, 403)
        return c.json({ error: e.message }, 500)
    }
})

/** POST /invoices/generate/:orderId - 生成适格请求书 */
invoices.post('/generate/:orderId', async (c) => {
    const orderId = Number(c.req.param('orderId'))
    const distributorId = c.get('distributorId')
    const body = await c.req.json<{ buyerName: string; invoiceDate?: string }>()

    if (!body.buyerName) {
        return c.json({ error: 'Buyer name is required' }, 400)
    }

    const service = new InvoiceService(c.env.DB)
    try {
        const invoice = await service.generateInvoice(orderId, distributorId, body.buyerName, body.invoiceDate)
        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId,
            action: 'GENERATE_INVOICE',
            resourceType: 'invoice',
            resourceId: String(invoice.id),
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

        return c.json({
            success: true,
            invoice: {
                ...invoice,
                tax_details: (() => { try { return JSON.parse(invoice.tax_details) } catch { return {} } })(),
            },
        }, 201)
    } catch (e: any) {
        if (e.message === 'Order not found') return c.json({ error: e.message }, 404)
        if (e.message === 'Order does not belong to you') return c.json({ error: e.message }, 403)
        return c.json({ error: e.message }, 400)
    }
})

/** GET /invoices/:id - Invoice 详情 */
invoices.get('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    const service = new InvoiceService(c.env.DB)
    try {
        const result = await service.getInvoice(id, distributorId)
        if (!result) return c.json({ error: 'Invoice not found' }, 404)
        return c.json(result)
    } catch (e: any) {
        if (e.message === 'Forbidden') return c.json({ error: 'Invoice does not belong to you' }, 403)
        return c.json({ error: e.message }, 500)
    }
})

/** GET /invoices - Invoice 列表 */
invoices.get('/', async (c) => {
    const distributorId = c.get('distributorId')
    const orderId = c.req.query('orderId') ? Number(c.req.query('orderId')) : undefined
    const rawLimit = Number(c.req.query('limit') || 50)
    const rawOffset = Number(c.req.query('offset') || 0)

    const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200))
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset)

    const service = new InvoiceService(c.env.DB)
    const { invoices: list, total } = await service.listInvoices(distributorId, { orderId, limit, offset })

    return c.json({
        invoices: list,
        total,
        count: list.length,
        hasMore: offset + list.length < total,
    })
})

export { invoices }
