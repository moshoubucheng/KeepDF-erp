import { api } from '../client'

interface DateRange {
  start_date?: string
  end_date?: string
}

function dateQuery(params: DateRange) {
  const q = new URLSearchParams()
  if (params.start_date) q.set('start_date', params.start_date)
  if (params.end_date) q.set('end_date', params.end_date)
  const qs = q.toString()
  return qs ? `?${qs}` : ''
}

function fetchRaw(path: string) {
  const token = localStorage.getItem('erp_token') || ''
  return fetch(`/api/v1/financial-reports${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export const financialReportsApi = {
  pnl: (params: DateRange = {}) =>
    api.get<{
      period: { start: string; end: string }
      revenue: { total: number; tax: number; orders: number }
      cogs: number
      gross_profit: number
      gross_margin: number
      expenses: { commission: number; refunds: number }
      net_profit: number
      net_margin: number
    }>(`/financial-reports/pnl${dateQuery(params)}`),

  pnlExport: (params: DateRange = {}) =>
    fetchRaw(`/pnl/export${dateQuery(params)}`).then((r) => r.text()),

  taxSummary: (params: DateRange = {}) =>
    api.get<{
      period: { start: string; end: string }
      total_tax: number
      total_taxable: number
      breakdown: Array<{ tax_rate: number; rate_label: string; order_count: number; taxable_amount: number; tax_amount: number }>
    }>(`/financial-reports/tax-summary${dateQuery(params)}`),

  taxSummaryExport: (params: DateRange = {}) =>
    fetchRaw(`/tax-summary/export${dateQuery(params)}`).then((r) => r.text()),

  reconciliation: (params: DateRange = {}) =>
    api.get<{
      period: { start: string; end: string }
      transactions: Array<{ type: string; count: number; total: number }>
      current_balance: number
      current_frozen: number
    }>(`/financial-reports/reconciliation${dateQuery(params)}`),

  reconciliationExport: (params: DateRange = {}) =>
    fetchRaw(`/reconciliation/export${dateQuery(params)}`).then((r) => r.text()),

  balanceSheet: () =>
    api.get<{
      as_of: string
      assets: { cash: number; frozen: number; inventory: number; inventory_units: number; total: number }
      liabilities: { pending_refunds: number; pending_commissions: number; total: number }
      equity: number
    }>('/financial-reports/balance-sheet'),

  pnlPdf: (params: DateRange = {}) =>
    fetchRaw(`/pnl/pdf${dateQuery(params)}`).then((r) => r.blob()),

  salesPdf: (period?: string) =>
    fetchRaw(`/sales/pdf${period ? `?period=${period}` : ''}`).then((r) => r.blob()),

  inventoryPdf: () =>
    fetchRaw('/inventory/pdf').then((r) => r.blob()),
}
