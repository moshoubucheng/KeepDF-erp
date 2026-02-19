import { useTranslation } from 'react-i18next'
import { ClipboardList, Package, ShoppingCart, Truck } from 'lucide-react'

interface StageData {
  label: string
  icon: React.ReactNode
  count: number
  color: string
}

interface Props {
  procurement: { status: string; count: number }[]
  inventory: { totalProducts: number; totalStock: number }
  orders: { status: string; count: number }[]
  shipments: { status: string; count: number }[]
}

export function FlowPipeline({ procurement, inventory, orders, shipments }: Props) {
  const { t } = useTranslation()

  const stages: StageData[] = [
    {
      label: t('supplyChain.procurement'),
      icon: <ClipboardList className="h-5 w-5" />,
      count: procurement.reduce((s, p) => s + p.count, 0),
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    {
      label: t('supplyChain.inventory'),
      icon: <Package className="h-5 w-5" />,
      count: inventory.totalStock,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      label: t('supplyChain.orders'),
      icon: <ShoppingCart className="h-5 w-5" />,
      count: orders.reduce((s, o) => s + o.count, 0),
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    {
      label: t('supplyChain.shipping'),
      icon: <Truck className="h-5 w-5" />,
      count: shipments.reduce((s, sh) => s + sh.count, 0),
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('supplyChain.flow')}</h3>
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-2">
            <div className={`flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 ${stage.color}`}>
              {stage.icon}
              <span className="whitespace-nowrap text-xs font-medium">{stage.label}</span>
              <span className="text-lg font-bold">{stage.count.toLocaleString()}</span>
            </div>
            {i < stages.length - 1 && (
              <svg className="h-4 w-6 flex-shrink-0 text-text-muted" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M0 8h18M14 2l6 6-6 6" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
