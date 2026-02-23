import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { FinancialReportsService } from '../services/financial-reports.service'
import { ReportPdfService } from '../services/report-pdf.service'
import { toCSV, csvResponse } from '../utils/csv'
import { adminOnly } from '../middleware/admin'

const financialReports = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /financial-reports/pnl - Profit & Loss statement */
financialReports.get('/pnl', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const pnl = await service.getPnL({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    return c.json(pnl)
})

/** GET /financial-reports/pnl/export - P&L CSV export */
financialReports.get('/pnl/export', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const pnl = await service.getPnL({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    const rows = [
        { item: 'Revenue', amount: pnl.revenue.total },
        { item: 'COGS', amount: pnl.cogs },
        { item: 'Gross Profit', amount: pnl.gross_profit },
        { item: 'Commission', amount: pnl.expenses.commission },
        { item: 'Refunds', amount: pnl.expenses.refunds },
        { item: 'Net Profit', amount: pnl.net_profit },
    ]

    const csv = toCSV(rows as Record<string, unknown>[], [
        { key: 'item', header: 'Item' },
        { key: 'amount', header: 'Amount' },
    ])

    return csvResponse(csv, 'pnl-report.csv')
})

/** GET /financial-reports/tax-summary - Tax summary */
financialReports.get('/tax-summary', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const summary = await service.getTaxSummary({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    return c.json(summary)
})

/** GET /financial-reports/tax-summary/export - Tax CSV export */
financialReports.get('/tax-summary/export', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const summary = await service.getTaxSummary({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    const csv = toCSV(summary.breakdown as Record<string, unknown>[], [
        { key: 'rate_label', header: 'Tax Rate' },
        { key: 'order_count', header: 'Order Count' },
        { key: 'taxable_amount', header: 'Taxable Amount' },
        { key: 'tax_amount', header: 'Tax Amount' },
    ])

    return csvResponse(csv, 'tax-summary.csv')
})

/** GET /financial-reports/reconciliation - Wallet reconciliation */
financialReports.get('/reconciliation', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const reconciliation = await service.getReconciliation({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    return c.json(reconciliation)
})

/** GET /financial-reports/reconciliation/export - Reconciliation CSV export */
financialReports.get('/reconciliation/export', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const reconciliation = await service.getReconciliation({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    const csv = toCSV(reconciliation.transactions as Record<string, unknown>[], [
        { key: 'type', header: 'Transaction Type' },
        { key: 'count', header: 'Count' },
        { key: 'total', header: 'Total' },
    ])

    return csvResponse(csv, 'reconciliation.csv')
})

/** GET /financial-reports/balance-sheet - Balance sheet */
financialReports.get('/balance-sheet', async (c) => {
    const service = new FinancialReportsService(c.env.DB)
    const balanceSheet = await service.getBalanceSheet({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
    })

    return c.json(balanceSheet)
})

/** GET /financial-reports/pnl/pdf - P&L PDF (admin-only) */
financialReports.get('/pnl/pdf', adminOnly, async (c) => {
    const service = new ReportPdfService(c.env.DB)
    const pdfBytes = await service.generatePnlPdf({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        startDate: c.req.query('start_date') || undefined,
        endDate: c.req.query('end_date') || undefined,
    })

    return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="pnl-report.pdf"',
            'Content-Length': String(pdfBytes.length),
        },
    })
})

/** GET /financial-reports/sales/pdf - Sales PDF (admin-only) */
financialReports.get('/sales/pdf', adminOnly, async (c) => {
    const service = new ReportPdfService(c.env.DB)
    const pdfBytes = await service.generateSalesPdf({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
        period: c.req.query('period') || undefined,
    })

    return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="sales-report.pdf"',
            'Content-Length': String(pdfBytes.length),
        },
    })
})

/** GET /financial-reports/inventory/pdf - Inventory PDF (admin-only) */
financialReports.get('/inventory/pdf', adminOnly, async (c) => {
    const service = new ReportPdfService(c.env.DB)
    const pdfBytes = await service.generateInventoryPdf({
        distributorId: c.get('distributorId'),
        role: c.get('role'),
    })

    return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="inventory-report.pdf"',
            'Content-Length': String(pdfBytes.length),
        },
    })
})

export { financialReports }
