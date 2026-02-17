import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { cn } from '@/utils/cn'

export type Period = '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: '7d', labelKey: 'dashboard.7d' },
  { value: '30d', labelKey: 'dashboard.30d' },
  { value: '90d', labelKey: 'dashboard.90d' },
]

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PROCESSING: '#3b82f6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
}

interface TrendChartProps {
  period: Period
  setPeriod: (p: Period) => void
  trendData: { date: string; count: number; revenue: number }[]
  trendLoading: boolean
  trendFetching: boolean
  orderStatusData: { name: string; value: number }[]
  statsLoading: boolean
  statsFetching: boolean
}

export function TrendChart({
  period,
  setPeriod,
  trendData,
  trendLoading,
  trendFetching,
  orderStatusData,
  statsLoading,
  statsFetching,
}: TrendChartProps) {
  const { t } = useTranslation()

  return (
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
          {trendLoading ? (
            <div className="h-[260px] animate-pulse rounded bg-bg-input/30" />
          ) : (
            <LineChart
              data={trendData}
              xKey="date"
              yKeys={['revenue', 'count']}
              height="260px"
              loading={trendFetching}
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
          {statsLoading ? (
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
              loading={statsFetching}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
