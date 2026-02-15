import { api } from '../client'

interface ReportParams {
  period?: string
  group_by?: string
}

export const reportsApi = {
  summary: (period = '30d') =>
    api.get<{ period: string; totalOrders: number; totalRevenue: number; avgOrderValue: number; profitMargin: number }>(
      `/reports/summary?period=${period}`
    ),

  profitAnalysis: (period = '30d', groupBy = 'product') =>
    api.get<{ period: string; groupBy: string; data: Array<Record<string, unknown>> }>(
      `/reports/profit-analysis?period=${period}&group_by=${groupBy}`
    ),

  platformComparison: (period = '30d') =>
    api.get<{ period: string; platforms: Array<{ platform: string; orders: number; revenue: number; avgOrder: number }> }>(
      `/reports/platform-comparison?period=${period}`
    ),

  trendComparison: (period = '30d', groupBy = 'day') =>
    api.get<{ period: string; groupBy: string; current: Array<Record<string, unknown>>; previous: Array<Record<string, unknown>> }>(
      `/reports/trend-comparison?period=${period}&group_by=${groupBy}`
    ),

  custom: (params: { start_date: string; end_date: string; dimensions: string; metrics: string }) => {
    const query = new URLSearchParams(params)
    return api.get<{ data: Array<Record<string, unknown>>; dimensions: string[]; metrics: string[] }>(
      `/reports/custom?${query.toString()}`
    )
  },

  customExport: (params: { start_date: string; end_date: string; dimensions: string; metrics: string }) => {
    const query = new URLSearchParams(params)
    const token = localStorage.getItem('erp_token') || ''
    return fetch(`/api/v1/reports/custom/export?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.text())
  },
}
