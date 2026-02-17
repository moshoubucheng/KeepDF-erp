import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { BarChart } from '@/components/charts/BarChart'

interface AdminChartsProps {
  heatmapData: { date: string; orderCount: number }[]
  heatmapLoading: boolean
  heatmapFetching: boolean
  turnoverData: { name: string; turnover_rate: number }[]
  turnoverLoading: boolean
  turnoverFetching: boolean
}

export function AdminCharts({
  heatmapData,
  heatmapLoading,
  heatmapFetching,
  turnoverData,
  turnoverLoading,
  turnoverFetching,
}: AdminChartsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Sales Heatmap */}
      <Card>
        <CardHeader className="py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.sales_heatmap')}
          </h3>
        </CardHeader>
        <CardContent className="py-2">
          {heatmapLoading ? (
            <div className="h-[240px] animate-pulse rounded bg-bg-input/30" />
          ) : (
            <BarChart
              data={heatmapData.slice(-14).map((d) => ({
                name: d.date,
                value: d.orderCount,
              }))}
              height="240px"
              loading={heatmapFetching}
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
          {turnoverLoading ? (
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
              loading={turnoverFetching}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
