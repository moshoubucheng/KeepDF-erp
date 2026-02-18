import { useTranslation } from 'react-i18next'
import { WIDGET_REGISTRY, type WidgetLayoutItem } from '../widget-registry'

interface Props {
  hiddenWidgets: WidgetLayoutItem[]
  onToggleVisibility: (id: string) => void
}

export function WidgetVisibilityPanel({ hiddenWidgets, onToggleVisibility }: Props) {
  const { t } = useTranslation()

  if (hiddenWidgets.length === 0) return null

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
      <p className="mb-2 text-sm font-medium text-text-muted">{t('dashboard.hidden_widgets')}</p>
      <div className="flex flex-wrap gap-2">
        {hiddenWidgets.map(item => {
          const def = WIDGET_REGISTRY[item.widgetId]
          return (
            <button
              key={item.widgetId}
              onClick={() => onToggleVisibility(item.widgetId)}
              className="flex items-center gap-1 rounded-lg bg-bg-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary"
              title={t('dashboard.show_widget')}
            >
              <span>+</span>
              <span>{def ? t(def.titleKey) : item.widgetId}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
