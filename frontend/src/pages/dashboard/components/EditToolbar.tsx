import { useTranslation } from 'react-i18next'

interface Props {
  editMode: boolean
  isSaving: boolean
  onToggleEdit: () => void
  onReset: () => void
}

export function EditToolbar({ editMode, isSaving, onToggleEdit, onReset }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleEdit}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          editMode
            ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
        }`}
      >
        {editMode ? t('dashboard.customize_done') : t('dashboard.customize')}
      </button>

      {editMode && (
        <>
          <button
            onClick={() => {
              if (window.confirm(t('dashboard.reset_confirm'))) onReset()
            }}
            className="rounded-lg bg-bg-secondary px-3 py-1.5 text-sm text-text-muted hover:bg-bg-tertiary"
          >
            {t('dashboard.reset_layout')}
          </button>

          {isSaving && (
            <span className="text-xs text-text-muted">{t('dashboard.layout_saved')}</span>
          )}
        </>
      )}
    </div>
  )
}
