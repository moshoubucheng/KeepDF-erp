import { useTranslation } from 'react-i18next'

interface Props {
  statuses: { status: string; count: number }[]
  isLoading: boolean
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-400',
  SUBMITTED: 'bg-blue-500',
  CONFIRMED: 'bg-indigo-500',
  SHIPPED: 'bg-purple-500',
  RECEIVED: 'bg-emerald-500',
  CLOSED: 'bg-gray-600',
  CANCELLED: 'bg-red-500',
}

export function SupplyChainStatusWidget({ statuses, isLoading }: Props) {
  const { t } = useTranslation()
  const maxCount = Math.max(...statuses.map((s) => s.count), 1)

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-bg-input" />
        ))}
      </div>
    )
  }

  if (statuses.length === 0) {
    return <p className="p-4 text-sm text-text-muted">{t('dashboard.no_data')}</p>
  }

  return (
    <div className="space-y-2.5 p-4">
      {statuses.map((s) => (
        <div key={s.status} className="flex items-center gap-3">
          <span className="w-24 truncate text-xs font-medium text-text-secondary">{s.status}</span>
          <div className="flex-1">
            <div className="h-5 overflow-hidden rounded-full bg-bg-input">
              <div
                className={`h-full rounded-full transition-all duration-500 ${STATUS_COLORS[s.status] || 'bg-accent-purple'}`}
                style={{ width: `${Math.max((s.count / maxCount) * 100, 4)}%` }}
              />
            </div>
          </div>
          <span className="w-8 text-right text-xs font-bold text-text-primary">{s.count}</span>
        </div>
      ))}
    </div>
  )
}
