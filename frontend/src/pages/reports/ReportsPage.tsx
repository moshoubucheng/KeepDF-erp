import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BarChart3, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatCard } from '@/components/data/StatCard'
import { cn } from '@/utils/cn'

type Period = '7d' | '30d' | '90d' | 'all'
type GroupBy = 'product' | 'platform'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
]

export default function ReportsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('30d')
  const [groupBy, setGroupBy] = useState<GroupBy>('product')
  const [trendGroupBy, setTrendGroupBy] = useState<'day' | 'week' | 'month'>('day')

  // Summary query
  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary', period],
    queryFn: () => reportsApi.summary(period),
    staleTime: 60_000,
  })

  // Profit analysis query
  const profitQuery = useQuery({
    queryKey: ['reports', 'profit-analysis', period, groupBy],
    queryFn: () => reportsApi.profitAnalysis(period, groupBy),
    staleTime: 60_000,
  })

  // Platform comparison query
  const platformQuery = useQuery({
    queryKey: ['reports', 'platform-comparison', period],
    queryFn: () => reportsApi.platformComparison(period),
    staleTime: 60_000,
  })

  // Trend comparison query
  const trendQuery = useQuery({
    queryKey: ['reports', 'trend-comparison', period, trendGroupBy],
    queryFn: () => reportsApi.trendComparison(period, trendGroupBy),
    staleTime: 60_000,
  })

  const summary = summaryQuery.data
  const profitData = (profitQuery.data?.data ?? []) as Record<string, unknown>[]
  const platforms = platformQuery.data?.platforms ?? []
  const trendCurrent = (trendQuery.data?.current ?? []) as Record<string, unknown>[]

  // Profit analysis columns
  const profitColumns = useMemo<Column<Record<string, unknown>>[]>(
    () => [
      {
        key: 'name',
        header: groupBy === 'product' ? t('reports.product', 'Product') : t('reports.platform', 'Platform'),
        render: (row) => (
          <span className="font-medium text-text-primary">
            {String(row.name ?? row.product ?? row.platform ?? '-')}
          </span>
        ),
      },
      {
        key: 'revenue',
        header: t('reports.revenue', 'Revenue'),
        render: (row) => (
          <span className="tabular-nums">{formatCurrency(Number(row.revenue ?? 0))}</span>
        ),
      },
      {
        key: 'cost',
        header: t('reports.cost', 'Cost'),
        render: (row) => (
          <span className="tabular-nums text-text-secondary">{formatCurrency(Number(row.cost ?? 0))}</span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'profit',
        header: t('reports.profit', 'Profit'),
        render: (row) => {
          const profit = Number(row.profit ?? 0)
          return (
            <span className={cn('tabular-nums font-medium', profit >= 0 ? 'text-accent-emerald' : 'text-accent-red')}>
              {formatCurrency(profit)}
            </span>
          )
        },
      },
      {
        key: 'margin',
        header: t('reports.margin', 'Margin'),
        render: (row) => {
          const margin = Number(row.margin ?? 0)
          return (
            <span className={cn('tabular-nums', margin >= 0 ? 'text-accent-emerald' : 'text-accent-red')}>
              {formatPercent(margin / 100, 1)}
            </span>
          )
        },
        hideOnMobile: true,
      },
    ],
    [t, groupBy],
  )

  // Platform comparison columns
  const platformColumns = useMemo<Column<{ platform: string; orders: number; revenue: number; avgOrder: number }>[]>(
    () => [
      {
        key: 'platform',
        header: t('reports.platform', 'Platform'),
        render: (row) => <span className="font-medium text-text-primary">{row.platform}</span>,
      },
      {
        key: 'orders',
        header: t('reports.orders', 'Orders'),
        render: (row) => <span className="tabular-nums">{formatNumber(row.orders)}</span>,
      },
      {
        key: 'revenue',
        header: t('reports.revenue', 'Revenue'),
        render: (row) => (
          <span className="tabular-nums font-medium text-accent-emerald">{formatCurrency(row.revenue)}</span>
        ),
      },
      {
        key: 'avgOrder',
        header: t('reports.avgOrder', 'Avg Order'),
        render: (row) => <span className="tabular-nums text-text-secondary">{formatCurrency(row.avgOrder)}</span>,
        hideOnMobile: true,
      },
    ],
    [t],
  )

  // Trend data columns
  const trendColumns = useMemo<Column<Record<string, unknown>>[]>(
    () => [
      {
        key: 'date',
        header: t('reports.date', 'Date'),
        render: (row) => <span className="text-text-secondary text-xs">{String(row.date ?? row.period ?? '-')}</span>,
      },
      {
        key: 'orders',
        header: t('reports.orders', 'Orders'),
        render: (row) => <span className="tabular-nums">{formatNumber(Number(row.orders ?? row.order_count ?? 0))}</span>,
      },
      {
        key: 'revenue',
        header: t('reports.revenue', 'Revenue'),
        render: (row) => (
          <span className="tabular-nums font-medium">{formatCurrency(Number(row.revenue ?? 0))}</span>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('reports.title', 'Reports')}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t('reports.subtitle', 'Sales analytics and performance insights')}
        </p>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary mr-2">
              {t('reports.period', 'Period')}:
            </span>
            <div className="flex items-center rounded-lg border border-border bg-bg-input p-0.5">
              {PERIOD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    period === value
                      ? 'bg-accent-purple text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingCart className="h-5 w-5" />}
          title={t('reports.totalOrders', 'Total Orders')}
          value={formatNumber(summary?.totalOrders ?? 0)}
          accent="blue"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          title={t('reports.totalRevenue', 'Total Revenue')}
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          accent="purple"
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          title={t('reports.avgOrderValue', 'Avg Order Value')}
          value={formatCurrency(summary?.avgOrderValue ?? 0)}
          accent="emerald"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          title={t('reports.profitMargin', 'Profit Margin')}
          value={`${(summary?.profitMargin ?? 0).toFixed(1)}%`}
          accent="amber"
        />
      </div>

      {/* Profit Analysis */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-text-primary font-semibold text-base">
              {t('reports.profitAnalysis', 'Profit Analysis')}
            </h3>
            <div className="flex items-center rounded-lg border border-border bg-bg-input p-0.5">
              <button
                onClick={() => setGroupBy('product')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-all',
                  groupBy === 'product'
                    ? 'bg-accent-purple text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {t('reports.byProduct', 'By Product')}
              </button>
              <button
                onClick={() => setGroupBy('platform')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-all',
                  groupBy === 'platform'
                    ? 'bg-accent-purple text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {t('reports.byPlatform', 'By Platform')}
              </button>
            </div>
          </div>
        </CardContent>
        <CardContent className="p-0">
          <DataTable
            columns={profitColumns}
            data={profitData}
            loading={profitQuery.isLoading}
            emptyMessage={t('reports.noData', 'No data available')}
            keyField="name"
          />
        </CardContent>
      </Card>

      {/* Platform Comparison */}
      <Card>
        <CardContent>
          <h3 className="text-text-primary font-semibold text-base">
            {t('reports.platformComparison', 'Platform Comparison')}
          </h3>
        </CardContent>
        <CardContent className="p-0">
          <DataTable
            columns={platformColumns}
            data={platforms}
            loading={platformQuery.isLoading}
            emptyMessage={t('reports.noPlatformData', 'No platform data available')}
            keyField="platform"
          />
        </CardContent>
      </Card>

      {/* Trend Comparison */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-text-primary font-semibold text-base">
              {t('reports.trendComparison', 'Trend Comparison')}
            </h3>
            <div className="flex items-center rounded-lg border border-border bg-bg-input p-0.5">
              {(['day', 'week', 'month'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setTrendGroupBy(g)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                    trendGroupBy === g
                      ? 'bg-accent-purple text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {t(`reports.${g}`, g.charAt(0).toUpperCase() + g.slice(1))}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardContent className="p-0">
          <DataTable
            columns={trendColumns}
            data={trendCurrent}
            loading={trendQuery.isLoading}
            emptyMessage={t('reports.noTrendData', 'No trend data available')}
            keyField="date"
          />
        </CardContent>
      </Card>
    </div>
  )
}
