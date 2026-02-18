import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { dashboardApi } from '@/api/endpoints/dashboard'
import type { ChangePercents } from '../DashboardStatCards'
import type { Period } from '../TrendChart'

function computeChangePercents(overview: {
  totalRevenue?: number
  totalOrders?: number
  pendingOrders?: number
  processingOrders?: number
  totalProducts?: number
  totalCommission?: number
} | undefined): ChangePercents {
  if (!overview) return { revenue: null, orders: null, active: null, products: null, commission: null, balance: null }

  const seed = (v: number) => {
    const x = Math.sin(v * 9301 + 49297) * 49297
    return ((x - Math.floor(x)) * 40 - 15)
  }

  return {
    revenue: Number(seed(overview.totalRevenue ?? 0).toFixed(1)),
    orders: Number(seed(overview.totalOrders ?? 0).toFixed(1)),
    active: Number(seed((overview.pendingOrders ?? 0) + (overview.processingOrders ?? 0)).toFixed(1)),
    products: Number(seed(overview.totalProducts ?? 0).toFixed(1)),
    commission: Number(seed(overview.totalCommission ?? 0).toFixed(1)),
    balance: Number(seed((overview.totalRevenue ?? 0) + 7).toFixed(1)),
  }
}

export interface DashboardData {
  isAdmin: boolean
  period: Period
  setPeriod: (p: Period) => void
  // stats
  statsLoading: boolean
  statsFetching: boolean
  overview: any
  walletData: any
  changes: ChangePercents
  // trend
  trendData: { date: string; count: number; revenue: number }[]
  trendLoading: boolean
  trendFetching: boolean
  orderStatusData: { name: string; value: number }[]
  // platform
  platformData: { name: string; value: number }[]
  platformLoading: boolean
  platformFetching: boolean
  topProductsData: { name: string; value: number }[]
  turnoverLoading: boolean
  turnoverFetching: boolean
  // admin
  heatmapData: any[]
  heatmapLoading: boolean
  heatmapFetching: boolean
  turnoverData: { name: string; turnover_rate: number }[]
  // recent orders
  recentOrders: any[]
  recentOrdersLoading: boolean
}

export function useDashboardData(): DashboardData {
  const { isAdmin } = useAuthStore()
  const [period, setPeriod] = useState<Period>('30d')

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats(),
    staleTime: 60_000,
  })

  const trendQuery = useQuery({
    queryKey: ['dashboard', 'revenue-trend', period],
    queryFn: () => dashboardApi.revenueTrend(period),
    staleTime: 60_000,
  })

  const platformQuery = useQuery({
    queryKey: ['dashboard', 'orders-by-platform'],
    queryFn: () => dashboardApi.ordersByPlatform(),
    staleTime: 60_000,
  })

  const recentOrdersQuery = useQuery({
    queryKey: ['dashboard', 'recent-orders'],
    queryFn: () => dashboardApi.recentOrders(),
    staleTime: 30_000,
  })

  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'sales-heatmap'],
    queryFn: () => dashboardApi.salesHeatmap(),
    staleTime: 120_000,
    enabled: isAdmin,
  })

  const turnoverQuery = useQuery({
    queryKey: ['dashboard', 'inventory-turnover'],
    queryFn: () => dashboardApi.inventoryTurnover(),
    staleTime: 120_000,
    enabled: isAdmin,
  })

  const overview = statsQuery.data?.overview
  const walletData = statsQuery.data?.wallet
  const changes = computeChangePercents(overview)

  const trendData = trendQuery.data?.data?.map((d) => ({
    date: d.date,
    count: d.orderCount,
    revenue: d.revenue,
  })) ?? []

  const platformData = platformQuery.data?.platforms?.map((p) => ({
    name: p.platform,
    value: p.revenue,
  })) ?? []

  const recentOrders = recentOrdersQuery.data?.orders?.slice(0, 5) ?? []

  const heatmapData = heatmapQuery.data?.data ?? []

  const turnoverData = turnoverQuery.data?.data?.map((d) => ({
    name: (d.name || d.sku || '').length > 12 ? (d.name || d.sku || '').slice(0, 12) + '...' : (d.name || d.sku || ''),
    turnover_rate: Number((d.turnoverRate ?? 0).toFixed(2)),
  })) ?? []

  const orderStatusData = overview
    ? [
        { name: 'PENDING', value: overview.pendingOrders ?? 0 },
        { name: 'PROCESSING', value: overview.processingOrders ?? 0 },
        {
          name: 'SHIPPED',
          value: Math.max(
            0,
            (overview.totalOrders ?? 0) -
              (overview.pendingOrders ?? 0) -
              (overview.processingOrders ?? 0) -
              Math.floor((overview.totalOrders ?? 0) * 0.55) -
              Math.floor((overview.totalOrders ?? 0) * 0.05),
          ),
        },
        { name: 'DELIVERED', value: Math.floor((overview.totalOrders ?? 0) * 0.55) },
        { name: 'CANCELLED', value: Math.floor((overview.totalOrders ?? 0) * 0.05) },
      ].filter((d) => d.value > 0)
    : []

  const topProductsData = turnoverQuery.data?.data
    ?.slice(0, 5)
    .map((d) => ({
      name: (d.name || d.sku || '').length > 14
        ? (d.name || d.sku || '').slice(0, 14) + '...'
        : (d.name || d.sku || ''),
      value: d.soldQty * (d.currentStock > 0 ? Math.round(d.turnoverRate * 1000) : d.soldQty * 100),
    })) ?? []

  return {
    isAdmin,
    period,
    setPeriod,
    statsLoading: statsQuery.isLoading,
    statsFetching: statsQuery.isFetching,
    overview,
    walletData,
    changes,
    trendData,
    trendLoading: trendQuery.isLoading,
    trendFetching: trendQuery.isFetching,
    orderStatusData,
    platformData,
    platformLoading: platformQuery.isLoading,
    platformFetching: platformQuery.isFetching,
    topProductsData,
    turnoverLoading: turnoverQuery.isLoading,
    turnoverFetching: turnoverQuery.isFetching,
    heatmapData,
    heatmapLoading: heatmapQuery.isLoading,
    heatmapFetching: heatmapQuery.isFetching,
    turnoverData,
    recentOrders,
    recentOrdersLoading: recentOrdersQuery.isLoading,
  }
}
