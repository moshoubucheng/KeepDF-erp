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

interface SupplyChainStatusResponse {
  statuses: { status: string; count: number }[]
}

interface OrderPipelineResponse {
  statuses: { status: string; count: number }[]
}

interface LowStockTopResponse {
  products: { id: number; sku: string; name_jp: string; name_cn: string; current_stock: number; reorder_point: number; days_of_stock: number }[]
}

interface SupplyChainOverviewResponse {
  procurement: { status: string; count: number }[]
  orders: { status: string; count: number }[]
  shipments: { status: string; count: number }[]
  inventory: { totalProducts: number; totalStock: number; lowStockCount: number; avgDaysOfStock: number }
  recentActivity: { type: string; id: number; status: string; created_at: string }[]
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

  getLayout: () =>
    api.get<{ layout: unknown[] }>('/dashboard/layout'),

  saveLayout: (layout: unknown[]) =>
    api.put<{ layout: unknown[] }>('/dashboard/layout', { layout }),

  supplyChainStatus: () =>
    api.get<SupplyChainStatusResponse>('/dashboard/supply-chain-status'),

  orderPipeline: () =>
    api.get<OrderPipelineResponse>('/dashboard/order-pipeline'),

  lowStockTop: () =>
    api.get<LowStockTopResponse>('/dashboard/low-stock-top'),

  supplyChainOverview: () =>
    api.get<SupplyChainOverviewResponse>('/dashboard/supply-chain-overview'),
}
