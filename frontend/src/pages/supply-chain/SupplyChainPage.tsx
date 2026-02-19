import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { Spinner } from '@/components/ui/Spinner'
import { FlowPipeline } from './components/FlowPipeline'
import { StageDetailCard } from './components/StageDetailCard'
import { ActivityTimeline } from './components/ActivityTimeline'

export default function SupplyChainPage() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['supply-chain', 'overview'],
    queryFn: () => dashboardApi.supplyChainOverview(),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    )
  }

  const procurement = data?.procurement ?? []
  const orders = data?.orders ?? []
  const shipments = data?.shipments ?? []
  const inventory = data?.inventory ?? { totalProducts: 0, totalStock: 0, lowStockCount: 0, avgDaysOfStock: 0 }
  const recentActivity = data?.recentActivity ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t('supplyChain.title')}</h1>
        <p className="mt-0.5 text-sm text-text-muted">{t('supplyChain.subtitle')}</p>
      </div>

      {/* Flow Pipeline */}
      <FlowPipeline
        procurement={procurement}
        inventory={inventory}
        orders={orders}
        shipments={shipments}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-bg-card p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{inventory.totalProducts}</p>
          <p className="text-xs text-text-muted">{t('supplyChain.totalProducts')}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{inventory.totalStock.toLocaleString()}</p>
          <p className="text-xs text-text-muted">{t('supplyChain.totalStock')}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{inventory.lowStockCount}</p>
          <p className="text-xs text-text-muted">{t('supplyChain.lowStock')}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{inventory.avgDaysOfStock}</p>
          <p className="text-xs text-text-muted">{t('supplyChain.avgDaysOfStock')}</p>
        </div>
      </div>

      {/* Stage detail cards + Activity Timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StageDetailCard title={t('supplyChain.procurement')} statuses={procurement} colorClass="bg-blue-500" />
          <StageDetailCard title={t('supplyChain.orders')} statuses={orders} colorClass="bg-purple-500" />
          <StageDetailCard title={t('supplyChain.shipping')} statuses={shipments} colorClass="bg-amber-500" />
          <StageDetailCard
            title={t('supplyChain.inventory')}
            statuses={[
              { status: t('supplyChain.totalProducts'), count: inventory.totalProducts },
              { status: t('supplyChain.totalStock'), count: inventory.totalStock },
              { status: t('supplyChain.lowStock'), count: inventory.lowStockCount },
            ]}
            colorClass="bg-emerald-500"
          />
        </div>
        <ActivityTimeline activities={recentActivity} />
      </div>
    </div>
  )
}
