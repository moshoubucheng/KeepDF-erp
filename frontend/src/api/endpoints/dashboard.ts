import { api } from '../client'
import type { DashboardStats, Order } from '../types'

export const dashboardApi = {
  stats: () => api.get<{ success: boolean } & DashboardStats>('/dashboard/stats'),

  recentOrders: () =>
    api.get<{ success: boolean; orders: Order[] }>('/dashboard/recent-orders'),

  orderTrend: (period = '30d') =>
    api.get<{ success: boolean; trend: { date: string; count: number; revenue: number }[] }>(`/dashboard/order-trend?period=${period}`),

  platformBreakdown: () =>
    api.get<{ success: boolean; platforms: { platform: string; count: number; revenue: number }[] }>('/dashboard/platform-breakdown'),

  salesHeatmap: () =>
    api.get<{ success: boolean; data: { day: number; hour: number; value: number }[] }>('/dashboard/sales-heatmap'),

  inventoryTurnover: () =>
    api.get<{ success: boolean; data: { sku: string; name: string; turnover_rate: number; sold_qty: number; current_stock: number }[] }>('/dashboard/inventory-turnover'),
}
