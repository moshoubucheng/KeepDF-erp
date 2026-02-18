import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { WIDGET_REGISTRY, type WidgetLayoutItem } from '../widget-registry'

interface Props {
  item: WidgetLayoutItem
  editMode: boolean
  onToggleVisibility: (id: string) => void
  onSetWidth: (id: string, w: 1 | 2) => void
  onMove?: (id: string, dir: 'up' | 'down') => void
  isMobile?: boolean
  children: React.ReactNode
}

export function SortableWidget({
  item,
  editMode,
  onToggleVisibility,
  onSetWidth,
  onMove,
  isMobile,
  children,
}: Props) {
  const { t } = useTranslation()
  const def = WIDGET_REGISTRY[item.widgetId]

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.widgetId, disabled: !editMode || isMobile })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const colSpan = item.width === 2 ? 'lg:col-span-2' : 'lg:col-span-1'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${colSpan} relative`}
    >
      {editMode && (
        <div className="absolute -top-2 left-0 right-0 z-10 flex items-center gap-1 px-2">
          {/* Drag handle (desktop only) */}
          {!isMobile && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted hover:bg-bg-tertiary active:cursor-grabbing"
              title={t('dashboard.drag_to_reorder')}
            >
              ⠿
            </button>
          )}

          {/* Widget title */}
          <span className="text-xs font-medium text-text-muted">
            {def ? t(def.titleKey) : item.widgetId}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* Mobile up/down buttons */}
            {isMobile && onMove && (
              <>
                <button
                  onClick={() => onMove(item.widgetId, 'up')}
                  className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted hover:bg-bg-tertiary"
                  title={t('dashboard.move_up')}
                >
                  ↑
                </button>
                <button
                  onClick={() => onMove(item.widgetId, 'down')}
                  className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted hover:bg-bg-tertiary"
                  title={t('dashboard.move_down')}
                >
                  ↓
                </button>
              </>
            )}

            {/* Width toggle */}
            <button
              onClick={() => onSetWidth(item.widgetId, item.width === 2 ? 1 : 2)}
              className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted hover:bg-bg-tertiary"
              title={item.width === 2 ? t('dashboard.width_half') : t('dashboard.width_full')}
            >
              {item.width === 2 ? '½' : '1'}
            </button>

            {/* Hide */}
            <button
              onClick={() => onToggleVisibility(item.widgetId)}
              className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted hover:bg-bg-tertiary"
              title={t('dashboard.hide_widget')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className={editMode ? 'mt-5 rounded-lg ring-1 ring-border-default ring-offset-1' : ''}>
        {children}
      </div>
    </div>
  )
}
