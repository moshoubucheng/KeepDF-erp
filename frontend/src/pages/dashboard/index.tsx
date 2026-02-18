import { useTranslation } from 'react-i18next'
import { useDashboardData } from './hooks/useDashboardData'
import { useDashboardLayout } from './hooks/useDashboardLayout'
import { EditToolbar } from './components/EditToolbar'
import { DashboardGrid } from './components/DashboardGrid'
import { WidgetVisibilityPanel } from './components/WidgetVisibilityPanel'

export default function DashboardPage() {
  const { t } = useTranslation()
  const dashboardData = useDashboardData()

  const {
    visibleWidgets,
    hiddenWidgets,
    editMode,
    setEditMode,
    reorderWidgets,
    moveWidget,
    toggleVisibility,
    setWidgetWidth,
    resetLayout,
    isSaving,
  } = useDashboardLayout(dashboardData.isAdmin)

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('dashboard.title')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{t('dashboard.subtitle')}</p>
        </div>
        <EditToolbar
          editMode={editMode}
          isSaving={isSaving}
          onToggleEdit={() => setEditMode(!editMode)}
          onReset={resetLayout}
        />
      </div>

      <DashboardGrid
        visibleWidgets={visibleWidgets}
        editMode={editMode}
        dashboardData={dashboardData}
        onReorder={reorderWidgets}
        onToggleVisibility={toggleVisibility}
        onSetWidth={setWidgetWidth}
        onMove={moveWidget}
      />

      {editMode && (
        <WidgetVisibilityPanel
          hiddenWidgets={hiddenWidgets}
          onToggleVisibility={toggleVisibility}
        />
      )}
    </div>
  )
}
