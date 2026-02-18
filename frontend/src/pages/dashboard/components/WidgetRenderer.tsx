import { DashboardStatCards } from '../DashboardStatCards'
import { QuickActions } from '../QuickActions'
import { TrendChart } from '../TrendChart'
import { PlatformCharts } from '../PlatformCharts'
import { AdminCharts } from '../AdminCharts'
import { RecentOrdersTable } from '../RecentOrdersTable'
import type { DashboardData } from '../hooks/useDashboardData'

interface Props {
  widgetId: string
  data: DashboardData
}

export function WidgetRenderer({ widgetId, data }: Props) {
  switch (widgetId) {
    case 'stats':
      return (
        <DashboardStatCards
          isLoading={data.statsLoading}
          isAdmin={data.isAdmin}
          overview={data.overview}
          walletData={data.walletData}
          changes={data.changes}
        />
      )
    case 'quickActions':
      return <QuickActions />
    case 'trendChart':
      return (
        <TrendChart
          period={data.period}
          setPeriod={data.setPeriod}
          trendData={data.trendData}
          trendLoading={data.trendLoading}
          trendFetching={data.trendFetching}
          orderStatusData={data.orderStatusData}
          statsLoading={data.statsLoading}
          statsFetching={data.statsFetching}
        />
      )
    case 'platformCharts':
      return (
        <PlatformCharts
          platformData={data.platformData}
          platformLoading={data.platformLoading}
          platformFetching={data.platformFetching}
          topProductsData={data.topProductsData}
          turnoverLoading={data.turnoverLoading}
          turnoverFetching={data.turnoverFetching}
          isAdmin={data.isAdmin}
        />
      )
    case 'adminCharts':
      return (
        <AdminCharts
          heatmapData={data.heatmapData}
          heatmapLoading={data.heatmapLoading}
          heatmapFetching={data.heatmapFetching}
          turnoverData={data.turnoverData}
          turnoverLoading={data.turnoverLoading}
          turnoverFetching={data.turnoverFetching}
        />
      )
    case 'recentOrders':
      return (
        <RecentOrdersTable
          orders={data.recentOrders}
          isLoading={data.recentOrdersLoading}
        />
      )
    default:
      return null
  }
}
