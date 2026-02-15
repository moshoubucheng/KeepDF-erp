import { api } from '../client'
import type { Order } from '../types'

// Backend response types (match actual dashboard.controller.ts)

interface StatsResponse {
  role: string
  overview: {
    totalOrders: number
    pendingOrders: number
    processingOrders: number
    totalRevenue: number
    totalProducts?: number
    lowStockCount?: number
    totalDistributors?: number
    totalCommission?: number
  }
  wallet?: { balance: number; frozen_balance: number }
}

interface RevenueTrendResponse {
  period: string
  groupBy: string
  data: { date: string; orderCount: number; revenue: number }[]
}

interface PlatformResponse {
  period: string
  platforms: { platform: string; orderCount: number; revenue: number; percentage: number }[]
  total: { orders: number; revenue: number }
}

interface HeatmapResponse {
  data: { date: string; orderCount: number; revenue: number }[]
}

interface TurnoverResponse {
  data: { sku: string; name: string; soldQty: number; currentStock: number; turnoverRate: number }[]
}

export const dashboardApi = {
  stats: () => api.get<StatsResponse>('/dashboard/stats'),

  recentOrders: () =>
    api.get<{ orders: Order[]; pagination: { total: number; page: number; limit: number; pages: number } }>('/orders?limit=5&page=1'),

  revenueTrend: (period = '30d') =>
    api.get<RevenueTrendResponse>(`/dashboard/revenue-trend?period=${period}`),

  ordersByPlatform: (period = '30d') =>
    api.get<PlatformResponse>(`/dashboard/orders-by-platform?period=${period}`),

  salesHeatmap: () =>
    api.get<HeatmapResponse>('/dashboard/sales-heatmap'),

  inventoryTurnover: () =>
    api.get<TurnoverResponse>('/dashboard/inventory-turnover'),
}
