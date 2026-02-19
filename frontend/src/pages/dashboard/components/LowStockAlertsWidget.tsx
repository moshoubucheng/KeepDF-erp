import { useTranslation } from 'react-i18next'

interface Product {
  id: number
  sku: string
  name_jp: string
  name_cn: string
  current_stock: number
  reorder_point: number
  days_of_stock: number
}

interface Props {
  products: Product[]
  isLoading: boolean
}

export function LowStockAlertsWidget({ products, isLoading }: Props) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-bg-input" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return <p className="p-4 text-sm text-text-muted">{t('dashboard.no_data')}</p>
  }

  return (
    <div className="space-y-3 p-4">
      {products.map((p) => {
        const ratio = p.reorder_point > 0 ? Math.min(p.current_stock / p.reorder_point, 1) : 0
        const barColor = ratio < 0.3 ? 'bg-red-500' : ratio < 0.6 ? 'bg-amber-500' : 'bg-emerald-500'

        return (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-xs font-medium text-text-primary">{p.name_jp || p.sku}</span>
              <span className="ml-2 whitespace-nowrap text-[10px] text-text-muted">
                {p.current_stock} / {p.reorder_point}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-input">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.max(ratio * 100, 2)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>{t('dashboard.low_stock_current')}: {p.current_stock}</span>
              <span>{t('dashboard.days_of_stock')}: {p.days_of_stock}{t('common.days', '日')}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
