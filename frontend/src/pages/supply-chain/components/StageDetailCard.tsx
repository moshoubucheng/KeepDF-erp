import { useTranslation } from 'react-i18next'

interface StatusItem {
  status: string
  count: number
}

interface Props {
  title: string
  statuses: StatusItem[]
  colorClass: string
}

export function StageDetailCard({ title, statuses, colorClass }: Props) {
  const { t } = useTranslation()
  const maxCount = Math.max(...statuses.map((s) => s.count), 1)

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h4 className="mb-3 text-sm font-semibold text-text-primary">{title}</h4>
      {statuses.length === 0 ? (
        <p className="text-xs text-text-muted">{t('dashboard.no_data')}</p>
      ) : (
        <div className="space-y-2">
          {statuses.map((s) => (
            <div key={s.status} className="flex items-center gap-2">
              <span className="w-20 truncate text-[11px] text-text-secondary">{s.status}</span>
              <div className="flex-1">
                <div className="h-3.5 overflow-hidden rounded-full bg-bg-input">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                    style={{ width: `${Math.max((s.count / maxCount) * 100, 4)}%` }}
                  />
                </div>
              </div>
              <span className="w-6 text-right text-[11px] font-bold text-text-primary">{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
