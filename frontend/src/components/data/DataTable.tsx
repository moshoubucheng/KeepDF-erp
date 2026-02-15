import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  selectedRows?: Set<number>
  onSelectRow?: (id: number) => void
  onSelectAll?: () => void
  keyField?: string
}

export function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage,
  onRowClick,
  selectedRows,
  onSelectRow,
  onSelectAll,
  keyField = 'id',
}: DataTableProps<T>) {
  const { t } = useTranslation()

  const hasSelection = onSelectRow !== undefined && selectedRows !== undefined

  const getKey = (row: T) => (row as Record<string, unknown>)[keyField] as number

  const allSelected =
    hasSelection && data.length > 0 && data.every((row) => selectedRows!.has(getKey(row)))

  const someSelected =
    hasSelection && !allSelected && data.some((row) => selectedRows!.has(getKey(row)))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted text-sm">
        {emptyMessage ?? t('common.noData', 'No data')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {hasSelection && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-border bg-bg-input accent-accent-purple"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted',
                  col.hideOnMobile && 'hidden md:table-cell',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const rowId = getKey(row)
            const isSelected = hasSelection && selectedRows!.has(rowId)

            return (
              <tr
                key={rowId ?? idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-border transition-colors',
                  onRowClick && 'cursor-pointer',
                  isSelected
                    ? 'bg-accent-purple/10'
                    : 'hover:bg-bg-card-hover',
                )}
              >
                {hasSelection && (
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation()
                        onSelectRow!(rowId)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-border bg-bg-input accent-accent-purple"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-text-primary',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.className,
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? '-'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
