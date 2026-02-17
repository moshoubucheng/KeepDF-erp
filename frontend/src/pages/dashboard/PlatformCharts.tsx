import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { PieChart } from '@/components/charts/PieChart'
import { BarChart } from '@/components/charts/BarChart'

interface PlatformChartsProps {
  platformData: { name: string; value: number }[]
  platformLoading: boolean
  platformFetching: boolean
  topProductsData: { name: string; value: number }[]
  turnoverLoading: boolean
  turnoverFetching: boolean
  isAdmin: boolean
}

export function PlatformCharts({
  platformData,
  platformLoading,
  platformFetching,
  topProductsData,
  turnoverLoading,
  turnoverFetching,
  isAdmin,
}: PlatformChartsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Platform Breakdown */}
      <Card>
        <CardHeader className="py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.platform_distribution')}
          </h3>
        </CardHeader>
        <CardContent className="py-2">
          {platformLoading ? (
            <div className="h-[260px] animate-pulse rounded bg-bg-input/30" />
          ) : (
            <PieChart
              data={platformData}
              height="260px"
              colors={['#ec4899', '#f97316', '#ef4444']}
              loading={platformFetching}
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
          {turnoverLoading && isAdmin ? (
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
              loading={turnoverFetching}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
