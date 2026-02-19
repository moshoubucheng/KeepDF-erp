import { useTranslation } from 'react-i18next'
import { ClipboardList, ShoppingCart, Truck } from 'lucide-react'

interface ActivityItem {
  type: string
  id: number
  status: string
  created_at: string
}

interface Props {
  activities: ActivityItem[]
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  order: { icon: <ShoppingCart className="h-3.5 w-3.5" />, label: '注文', color: 'bg-purple-500' },
  purchase_order: { icon: <ClipboardList className="h-3.5 w-3.5" />, label: '発注', color: 'bg-blue-500' },
  shipment: { icon: <Truck className="h-3.5 w-3.5" />, label: '出荷', color: 'bg-amber-500' },
}

export function ActivityTimeline({ activities }: Props) {
  const { t } = useTranslation()

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('supplyChain.recentActivity')}</h3>
        <p className="text-xs text-text-muted">{t('supplyChain.noActivity')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('supplyChain.recentActivity')}</h3>
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-border" />

        {activities.map((item, i) => {
          const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.order
          const dateStr = new Date(item.created_at).toLocaleString('ja-JP', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })

          return (
            <div key={`${item.type}-${item.id}-${i}`} className="relative flex items-start gap-3 pb-3">
              {/* Dot */}
              <div className={`z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white ${config.color}`}>
                {config.icon}
              </div>
              {/* Content */}
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">
                    {config.label} #{item.id}
                  </span>
                  <span className="rounded bg-bg-input px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                    {item.status}
                  </span>
                </div>
                <span className="text-[10px] text-text-muted">{dateStr}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
