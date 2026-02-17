import { cn } from '@/utils/cn'
import type { Column } from './DataTable'

interface MobileCardProps<T> {
  row: T
  columns: Column<T>[]
  keyField?: string
  onClick?: (row: T) => void
  selected?: boolean
  onSelect?: (id: number) => void
  cardRender?: (row: T) => React.ReactNode
}

/**
 * Mobile card view for DataTable rows.
 * Renders as a key-value card by default, or uses custom cardRender if provided.
 */
export function MobileCard<T extends object>({
  row,
  columns,
  keyField = 'id',
  onClick,
  selected,
  onSelect,
  cardRender,
}: MobileCardProps<T>) {
  const rowId = (row as Record<string, unknown>)[keyField] as number

  if (cardRender) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-bg-card p-3 transition-colors',
          onClick && 'cursor-pointer hover:bg-bg-card-hover',
          selected && 'border-accent-purple bg-accent-purple/5',
        )}
        onClick={() => onClick?.(row)}
      >
        {onSelect && (
          <div className="mb-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation()
                onSelect(rowId)
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border bg-bg-input accent-accent-purple"
            />
          </div>
        )}
        {cardRender(row)}
      </div>
    )
  }

  // Default key-value layout
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-bg-card p-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-bg-card-hover',
        selected && 'border-accent-purple bg-accent-purple/5',
      )}
      onClick={() => onClick?.(row)}
    >
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              onSelect(rowId)
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-border bg-bg-input accent-accent-purple"
          />
        )}
        <div className="flex-1 space-y-1.5">
          {columns.map((col) => {
            const value = col.render
              ? col.render(row)
              : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? '-'
            return (
              <div key={col.key} className="flex items-start justify-between gap-2">
                <span className="text-xs text-text-muted shrink-0">{col.header}</span>
                <span className="text-sm text-text-primary text-right">{value}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
