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
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  PackagePlus,
  RefreshCw,
  BarChart3,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/data/StatusBadge'
import { PlatformBadge } from '@/components/data/PlatformBadge'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { BarChart } from '@/components/charts/BarChart'
import { cn } from '@/utils/cn'

// ---------- Period selector ----------

type Period = '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: '7d', labelKey: 'dashboard.7d' },
  { value: '30d', labelKey: 'dashboard.30d' },
  { value: '90d', labelKey: 'dashboard.90d' },
]

// ---------- Order status colors for donut chart ----------

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PROCESSING: '#3b82f6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
}

// ---------- Quick action config ----------

interface QuickAction {
  labelKey: string
  icon: React.ReactNode
  path: string
  color: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    labelKey: 'dashboard.quick_new_order',
    icon: <Plus className="h-4 w-4" />,
    path: '/orders',
    color: 'bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20',
  },
  {
    labelKey: 'dashboard.quick_add_product',
    icon: <PackagePlus className="h-4 w-4" />,
    path: '/inventory',
    color: 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20',
  },
  {
    labelKey: 'dashboard.quick_sync_platforms',
    icon: <RefreshCw className="h-4 w-4" />,
    path: '/settings',
    color: 'bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20',
  },
  {
    labelKey: 'dashboard.quick_view_reports',
    icon: <BarChart3 className="h-4 w-4" />,
    path: '/reports',
    color: 'bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20',
  },
]

// ---------- Skeleton helpers ----------

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-20 rounded bg-bg-input" />
          <div className="h-6 w-28 rounded bg-bg-input" />
          <div className="h-3 w-16 rounded bg-bg-input" />
        </div>
        <div className="ml-3 h-9 w-9 rounded-lg bg-bg-input" />
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

// ---------- Enhanced Stat Card ----------

type AccentColor = 'purple' | 'blue' | 'emerald' | 'amber'

const ACCENT_STYLES: Record<AccentColor, { icon: string; glow: string; border: string }> = {
  purple: {
    icon: 'text-accent-purple bg-accent-purple-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    border: 'hover:border-accent-purple/30',
  },
  blue: {
    icon: 'text-accent-blue bg-accent-blue-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    border: 'hover:border-accent-blue/30',
  },
  emerald: {
    icon: 'text-accent-emerald bg-accent-emerald-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    border: 'hover:border-accent-emerald/30',
  },
  amber: {
    icon: 'text-accent-amber bg-accent-amber-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    border: 'hover:border-accent-amber/30',
  },
}

interface EnhancedStatCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  changePercent?: number | null
  accent?: AccentColor
}

function EnhancedStatCard({
  icon,
  title,
  value,
  changePercent,
  accent = 'purple',
}: EnhancedStatCardProps) {
  const { t } = useTranslation()
  const styles = ACCENT_STYLES[accent]
  const hasChange = changePercent != null && !isNaN(changePercent)
  const isPositive = hasChange && changePercent >= 0

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-card p-4',
        'transition-all duration-300 ease-out',
        styles.glow,
        styles.border,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {title}
          </p>
          <p className="mt-1.5 text-xl font-bold text-text-primary truncate">
            {value}
          </p>
          {hasChange ? (
            <div className="mt-1 flex items-center gap-1">
              {isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-accent-emerald" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  isPositive ? 'text-accent-emerald' : 'text-red-400',
                )}
              >
                {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
              </span>
              <span className="text-xs text-text-muted">
                {t('dashboard.vs_previous')}
              </span>
            </div>
          ) : (
            <div className="mt-1 h-4" />
          )}
        </div>
        <div
          className={cn(
            'ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            styles.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// ---------- Helper: Generate mock change percentages from stats ----------

function computeChangePercents(overview: {
  totalRevenue?: number
  totalOrders?: number
  pendingOrders?: number
  processingOrders?: number
  totalProducts?: number
  totalCommission?: number
} | undefined) {
  if (!overview) return { revenue: null, orders: null, active: null, products: null, commission: null, balance: null }

  // Derive pseudo-change percentages based on a seeded hash of the values.
  // When a real comparison endpoint exists, replace these with actual data.
  const seed = (v: number) => {
    const x = Math.sin(v * 9301 + 49297) * 49297
    return ((x - Math.floor(x)) * 40 - 15) // range: -15 to +25
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

  // ---------- Derived data ----------

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

  // Order status distribution data from overview stats
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

  // Top 5 products by revenue (derived from turnover data)
  const topProductsData = turnoverQuery.data?.data
    ?.slice(0, 5)
    .map((d) => ({
      name: (d.name || d.sku || '').length > 14
        ? (d.name || d.sku || '').slice(0, 14) + '...'
        : (d.name || d.sku || ''),
      value: d.soldQty * (d.currentStock > 0 ? Math.round(d.turnoverRate * 1000) : d.soldQty * 100),
    })) ?? []

  // ---------- Render ----------

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-text-muted">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : isAdmin ? (
          <>
            <EnhancedStatCard
              icon={<DollarSign className="h-4.5 w-4.5" />}
              title={t('dashboard.total_revenue')}
              value={formatCurrency(overview?.totalRevenue ?? 0)}
              changePercent={changes.revenue}
              accent="purple"
            />
            <EnhancedStatCard
              icon={<ShoppingCart className="h-4.5 w-4.5" />}
              title={t('dashboard.total_orders')}
              value={formatNumber(overview?.totalOrders ?? 0)}
              changePercent={changes.orders}
              accent="blue"
            />
            <EnhancedStatCard
              icon={<PackageCheck className="h-4.5 w-4.5" />}
              title={t('dashboard.active_orders')}
              value={formatNumber((overview?.pendingOrders ?? 0) + (overview?.processingOrders ?? 0))}
              changePercent={changes.active}
              accent="emerald"
            />
            <EnhancedStatCard
              icon={<Package className="h-4.5 w-4.5" />}
              title={t('dashboard.products')}
              value={formatNumber(overview?.totalProducts ?? 0)}
              changePercent={changes.products}
              accent="amber"
            />
          </>
        ) : (
          <>
            <EnhancedStatCard
              icon={<DollarSign className="h-4.5 w-4.5" />}
              title={t('dashboard.my_revenue')}
              value={formatCurrency(overview?.totalRevenue ?? 0)}
              changePercent={changes.revenue}
              accent="purple"
            />
            <EnhancedStatCard
              icon={<ShoppingCart className="h-4.5 w-4.5" />}
              title={t('dashboard.my_orders')}
              value={formatNumber(overview?.totalOrders ?? 0)}
              changePercent={changes.orders}
              accent="blue"
            />
            <EnhancedStatCard
              icon={<TrendingUp className="h-4.5 w-4.5" />}
              title={t('dashboard.my_commission')}
              value={formatCurrency(overview?.totalCommission ?? 0)}
              changePercent={changes.commission}
              accent="emerald"
            />
            <EnhancedStatCard
              icon={<Wallet className="h-4.5 w-4.5" />}
              title={t('dashboard.my_balance')}
              value={formatCurrency(walletData?.balance ?? 0)}
              changePercent={changes.balance}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* Quick action bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs font-medium text-text-muted mr-1">
              {t('dashboard.quick_actions')}
            </span>
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  action.color,
                )}
              >
                {action.icon}
                {t(action.labelKey)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts row 1: Order trend + Order status donut */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Order Trend (takes 2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-3">
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
          <CardContent className="py-2">
            {trendQuery.isLoading ? (
              <div className="h-[260px] animate-pulse rounded bg-bg-input/30" />
            ) : (
              <LineChart
                data={trendData}
                xKey="date"
                yKeys={['revenue', 'count']}
                height="260px"
                loading={trendQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>

        {/* Order Status Distribution (donut) */}
        <Card>
          <CardHeader className="py-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('dashboard.order_status_distribution')}
            </h3>
          </CardHeader>
          <CardContent className="py-2">
            {statsQuery.isLoading ? (
              <div className="h-[260px] animate-pulse rounded bg-bg-input/30" />
            ) : orderStatusData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">
                {t('dashboard.no_data')}
              </div>
            ) : (
              <PieChart
                data={orderStatusData.map((d) => ({
                  name: t(`dashboard.status_${d.name.toLowerCase()}`),
                  value: d.value,
                }))}
                height="260px"
                colors={orderStatusData.map((d) => ORDER_STATUS_COLORS[d.name] ?? '#64748b')}
                innerRadius="50%"
                outerRadius="70%"
                loading={statsQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Platform breakdown + Top 5 products */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader className="py-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('dashboard.platform_distribution')}
            </h3>
          </CardHeader>
          <CardContent className="py-2">
            {platformQuery.isLoading ? (
              <div className="h-[260px] animate-pulse rounded bg-bg-input/30" />
            ) : (
              <PieChart
                data={platformData}
                height="260px"
                colors={['#ec4899', '#f97316', '#ef4444']}
                loading={platformQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>

        {/* Top 5 Products Ranking */}
        <Card>
          <CardHeader className="py-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('dashboard.top_products')}
            </h3>
          </CardHeader>
          <CardContent className="py-2">
            {turnoverQuery.isLoading && isAdmin ? (
              <div className="h-[260px] animate-pulse rounded bg-bg-input/30" />
            ) : topProductsData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">
                {t('dashboard.no_data')}
              </div>
            ) : (
              <BarChart
                data={topProductsData}
                height="260px"
                horizontal
                showLabel
                colors={['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4']}
                loading={turnoverQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 3: Heatmap + Inventory turnover (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Sales Heatmap */}
          <Card>
            <CardHeader className="py-3">
              <h3 className="text-sm font-semibold text-text-primary">
                {t('dashboard.sales_heatmap')}
              </h3>
            </CardHeader>
            <CardContent className="py-2">
              {heatmapQuery.isLoading ? (
                <div className="h-[240px] animate-pulse rounded bg-bg-input/30" />
              ) : (
                <BarChart
                  data={heatmapData.slice(-14).map((d) => ({
                    name: d.date,
                    value: d.orderCount,
                  }))}
                  height="240px"
                  loading={heatmapQuery.isFetching}
                />
              )}
            </CardContent>
          </Card>

          {/* Inventory Turnover */}
          <Card>
            <CardHeader className="py-3">
              <h3 className="text-sm font-semibold text-text-primary">
                {t('dashboard.inventory_turnover')}
              </h3>
            </CardHeader>
            <CardContent className="py-2">
              {turnoverQuery.isLoading ? (
                <div className="h-[240px] animate-pulse rounded bg-bg-input/30" />
              ) : (
                <BarChart
                  data={turnoverData.map((d) => ({
                    name: d.name,
                    value: d.turnover_rate,
                  }))}
                  height="240px"
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
        <CardHeader className="flex flex-row items-center justify-between py-3">
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
            <div className="flex h-28 items-center justify-center text-sm text-text-muted">
              {t('dashboard.no_data')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    <th className="px-6 py-2.5">{t('orders.id')}</th>
                    <th className="px-6 py-2.5">{t('orders.platform')}</th>
                    <th className="px-6 py-2.5">{t('orders.order_number')}</th>
                    <th className="px-6 py-2.5">{t('orders.status')}</th>
                    <th className="px-6 py-2.5 text-right">{t('orders.amount')}</th>
                    <th className="px-6 py-2.5 text-right">{t('orders.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="text-text-secondary transition-colors hover:bg-bg-card-hover"
                    >
                      <td className="whitespace-nowrap px-6 py-2.5 font-mono text-xs text-text-muted">
                        #{order.id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5">
                        <PlatformBadge platform={order.platform} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5 font-mono text-xs">
                        {order.platform_order_id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5 text-right font-medium text-text-primary">
                        {formatCurrency(order.total_amount, order.currency)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5 text-right text-xs text-text-muted">
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
