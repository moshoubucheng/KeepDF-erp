import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { SortableWidget } from './SortableWidget'
import { WidgetRenderer } from './WidgetRenderer'
import type { WidgetLayoutItem } from '../widget-registry'
import type { DashboardData } from '../hooks/useDashboardData'

interface Props {
  visibleWidgets: WidgetLayoutItem[]
  editMode: boolean
  dashboardData: DashboardData
  onReorder: (activeId: string, overId: string) => void
  onToggleVisibility: (id: string) => void
  onSetWidth: (id: string, w: 1 | 2) => void
  onMove: (id: string, dir: 'up' | 'down') => void
}

export function DashboardGrid({
  visibleWidgets,
  editMode,
  dashboardData,
  onReorder,
  onToggleVisibility,
  onSetWidth,
  onMove,
}: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id))
    }
  }

  const items = visibleWidgets.map(w => w.widgetId)

  const gridContent = visibleWidgets.map(item => (
    <SortableWidget
      key={item.widgetId}
      item={item}
      editMode={editMode}
      onToggleVisibility={onToggleVisibility}
      onSetWidth={onSetWidth}
      onMove={onMove}
      isMobile={isMobile}
    >
      <WidgetRenderer widgetId={item.widgetId} data={dashboardData} />
    </SortableWidget>
  ))

  if (isMobile || !editMode) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {gridContent}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {gridContent}
        </div>
      </SortableContext>
    </DndContext>
  )
}
