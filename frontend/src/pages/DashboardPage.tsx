import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  DollarSign,
  ShoppingCart,
  PackageCheck,
  Package,
  Wallet,
  TrendingUp,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/data/StatCard'
import { StatusBadge } from '@/components/data/StatusBadge'
import { PlatformBadge } from '@/components/data/PlatformBadge'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { BarChart } from '@/components/charts/BarChart'
import { HeatmapChart } from '@/components/charts/HeatmapChart'
import { cn } from '@/utils/cn'

// ---------- Period selector ----------

type Period = '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: '7d', labelKey: 'dashboard.7d' },
  { value: '30d', labelKey: 'dashboard.30d' },
  { value: '90d', labelKey: 'dashboard.90d' },
]

// ---------- Skeleton helpers ----------

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-20 rounded bg-bg-input" />
          <div className="h-7 w-28 rounded bg-bg-input" />
          <div className="h-3 w-16 rounded bg-bg-input" />
        </div>
        <div className="ml-4 h-10 w-10 rounded-lg bg-bg-input" />
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-12 rounded bg-bg-input" />
          <div className="h-4 w-20 rounded bg-bg-input" />
          <div className="h-4 flex-1 rounded bg-bg-input" />
          <div className="h-4 w-16 rounded bg-bg-input" />
          <div className="h-4 w-24 rounded bg-bg-input" />
        </div>
      ))}
    </div>
  )
}

// ---------- Main Component ----------

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAdmin } = useAuthStore()
  const [period, setPeriod] = useState<Period>('30d')

  // ---------- Queries ----------

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats(),
    staleTime: 60_000,
  })

  const trendQuery = useQuery({
    queryKey: ['dashboard', 'order-trend', period],
    queryFn: () => dashboardApi.orderTrend(period),
    staleTime: 60_000,
  })

  const platformQuery = useQuery({
    queryKey: ['dashboard', 'platform-breakdown'],
    queryFn: () => dashboardApi.platformBreakdown(),
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

  // ---------- Derived data ----------

  const stats = statsQuery.data

  const trendData = trendQuery.data?.trend?.map((d) => ({
    date: d.date,
    count: d.count,
    revenue: d.revenue,
  })) ?? []

  const platformData = platformQuery.data?.platforms?.map((p) => ({
    name: p.platform,
    value: p.revenue,
  })) ?? []

  const recentOrders = recentOrdersQuery.data?.orders?.slice(0, 5) ?? []

  const heatmapData = heatmapQuery.data?.data ?? []

  const turnoverData = turnoverQuery.data?.data?.map((d) => ({
    name: d.name.length > 12 ? d.name.slice(0, 12) + '...' : d.name,
    turnover_rate: Number(d.turnover_rate.toFixed(2)),
  })) ?? []

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-text-muted">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : isAdmin ? (
          <>
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              title={t('dashboard.total_revenue')}
              value={formatCurrency(stats?.totalRevenue ?? 0)}
              accent="purple"
            />
            <StatCard
              icon={<ShoppingCart className="h-5 w-5" />}
              title={t('dashboard.total_orders')}
              value={formatNumber(stats?.totalOrders ?? 0)}
              accent="blue"
            />
            <StatCard
              icon={<PackageCheck className="h-5 w-5" />}
              title={t('dashboard.active_orders')}
              value={formatNumber(stats?.activeOrders ?? 0)}
              accent="emerald"
            />
            <StatCard
              icon={<Package className="h-5 w-5" />}
              title={t('dashboard.products')}
              value={formatNumber(stats?.totalProducts ?? 0)}
              accent="amber"
            />
          </>
        ) : (
          <>
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              title={t('dashboard.my_revenue')}
              value={formatCurrency(stats?.myRevenue ?? 0)}
              accent="purple"
            />
            <StatCard
              icon={<ShoppingCart className="h-5 w-5" />}
              title={t('dashboard.my_orders')}
              value={formatNumber(stats?.myOrders ?? 0)}
              accent="blue"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              title={t('dashboard.my_commission')}
              value={formatCurrency(stats?.myCommission ?? 0)}
              accent="emerald"
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              title={t('dashboard.my_balance')}
              value={formatCurrency(stats?.myBalance ?? 0)}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* Charts row 1: Order trend + Platform breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Order Trend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('dashboard.order_trend')}
            </h3>
            <div className="flex items-center rounded-lg border border-border bg-bg-input p-0.5">
              {PERIOD_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    period === value
                      ? 'bg-accent-purple text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {trendQuery.isLoading ? (
              <div className="h-[300px] animate-pulse rounded bg-bg-input/30" />
            ) : (
              <LineChart
                data={trendData}
                xKey="date"
                yKeys={['revenue', 'count']}
                height="300px"
                loading={trendQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-text-primary">
              {t('dashboard.platform_distribution')}
            </h3>
          </CardHeader>
          <CardContent>
            {platformQuery.isLoading ? (
              <div className="h-[300px] animate-pulse rounded bg-bg-input/30" />
            ) : (
              <PieChart
                data={platformData}
                height="300px"
                colors={['#ec4899', '#f97316', '#ef4444']}
                loading={platformQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Heatmap + Inventory turnover (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Sales Heatmap */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-text-primary">
                {t('dashboard.sales_heatmap')}
              </h3>
            </CardHeader>
            <CardContent>
              {heatmapQuery.isLoading ? (
                <div className="h-[280px] animate-pulse rounded bg-bg-input/30" />
              ) : (
                <HeatmapChart
                  data={heatmapData}
                  height="280px"
                  loading={heatmapQuery.isFetching}
                />
              )}
            </CardContent>
          </Card>

          {/* Inventory Turnover */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-text-primary">
                {t('dashboard.inventory_turnover')}
              </h3>
            </CardHeader>
            <CardContent>
              {turnoverQuery.isLoading ? (
                <div className="h-[280px] animate-pulse rounded bg-bg-input/30" />
              ) : (
                <BarChart
                  data={turnoverData.map((d) => ({
                    name: d.name,
                    value: d.turnover_rate,
                  }))}
                  height="280px"
                  horizontal
                  showLabel
                  loading={turnoverQuery.isFetching}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.recent_orders')}
          </h3>
          <button
            onClick={() => navigate('/orders')}
            className="text-xs font-medium text-accent-purple hover:underline"
          >
            {t('dashboard.view_all')}
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrdersQuery.isLoading ? (
            <TableSkeleton />
          ) : recentOrders.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-text-muted">
              {t('dashboard.no_data')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    <th className="px-6 py-3">{t('orders.id')}</th>
                    <th className="px-6 py-3">{t('orders.platform')}</th>
                    <th className="px-6 py-3">{t('orders.order_number')}</th>
                    <th className="px-6 py-3">{t('orders.status')}</th>
                    <th className="px-6 py-3 text-right">{t('orders.amount')}</th>
                    <th className="px-6 py-3 text-right">{t('orders.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="text-text-secondary transition-colors hover:bg-bg-card-hover"
                    >
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-text-muted">
                        #{order.id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <PlatformBadge platform={order.platform} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-xs">
                        {order.platform_order_id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-text-primary">
                        {formatCurrency(order.total_amount, order.currency)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right text-xs text-text-muted">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
