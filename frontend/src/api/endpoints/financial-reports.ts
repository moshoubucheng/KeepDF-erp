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
      revenue: { total: number; byPlatform: Array<{ platform: string; amount: number }> }
      cogs: number
      gross_profit: number
      expenses: { commission: number; refunds: number }
      net_profit: number
    }>(`/financial-reports/pnl${dateQuery(params)}`),

  pnlExport: (params: DateRange = {}) =>
    fetchRaw(`/pnl/export${dateQuery(params)}`).then((r) => r.text()),

  taxSummary: (params: DateRange = {}) =>
    api.get<{
      total_tax: number
      breakdown: Array<{ rate_label: string; order_count: number; taxable_amount: number; tax_amount: number }>
    }>(`/financial-reports/tax-summary${dateQuery(params)}`),

  taxSummaryExport: (params: DateRange = {}) =>
    fetchRaw(`/tax-summary/export${dateQuery(params)}`).then((r) => r.text()),

  reconciliation: (params: DateRange = {}) =>
    api.get<{
      opening_balance: number
      closing_balance: number
      expected_balance: number
      discrepancy: number
      transactions: Array<{ type: string; count: number; total: number }>
    }>(`/financial-reports/reconciliation${dateQuery(params)}`),

  reconciliationExport: (params: DateRange = {}) =>
    fetchRaw(`/reconciliation/export${dateQuery(params)}`).then((r) => r.text()),

  balanceSheet: () =>
    api.get<{
      asOf: string
      assets: { cash: number; inventory: number; total: number }
      liabilities: { payables: number; total: number }
      equity: { retained_earnings: number; total: number }
    }>('/financial-reports/balance-sheet'),

  pnlPdf: (params: DateRange = {}) =>
    fetchRaw(`/pnl/pdf${dateQuery(params)}`).then((r) => r.blob()),

  salesPdf: (period?: string) =>
    fetchRaw(`/sales/pdf${period ? `?period=${period}` : ''}`).then((r) => r.blob()),

  inventoryPdf: () =>
    fetchRaw('/inventory/pdf').then((r) => r.blob()),
}
