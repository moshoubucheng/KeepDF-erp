import { useState, useCallback } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

interface CsvExportButtonProps {
  exportFn: () => Promise<void>
  label?: string
  className?: string
}

export function CsvExportButton({ exportFn, label, className }: CsvExportButtonProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const handleExport = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      await exportFn()
    } finally {
      setLoading(false)
    }
  }, [exportFn, loading])

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2',
        'text-sm font-medium text-text-secondary',
        'transition-colors hover:bg-bg-card-hover hover:text-text-primary hover:border-border-hover',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label ?? t('common.export', 'CSV Export')}
    </button>
  )
}
