import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ArrowUp, ArrowDown, Settings2, X, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { MobileCard } from './MobileCard'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
  /** Enable sorting on this column */
  sortable?: boolean
  /** Enable filtering on this column */
  filterable?: boolean
  /** If provided, show a dropdown filter instead of text input */
  filterOptions?: string[]
  /** Enable drag-to-resize on this column */
  resizable?: boolean
}

export type SortDirection = 'asc' | 'desc' | null

export interface SortState {
  key: string
  direction: SortDirection
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
  /** Unique ID for persisting column widths / visibility to localStorage */
  tableId?: string
  /** Show column visibility toggle button */
  columnToggle?: boolean
  /** Sticky table header on vertical scroll */
  stickyHeader?: boolean
  /** Server-side sort callback. If provided, sorting is NOT done client-side. */
  onSort?: (sort: SortState) => void
  /** Show mobile card view on small screens */
  mobileCardView?: boolean
  /** Custom card renderer for mobile view */
  cardRender?: (row: T) => React.ReactNode
}

// ──────────────────────────────────────────────
// localStorage helpers
// ──────────────────────────────────────────────

function loadFromStorage<V>(key: string, fallback: V): V {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as V
  } catch { /* ignore */ }
  return fallback
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

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
  tableId,
  columnToggle = false,
  stickyHeader = false,
  onSort,
  mobileCardView = false,
  cardRender,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  const hasSelection = onSelectRow !== undefined && selectedRows !== undefined

  const getKey = (row: T) => (row as Record<string, unknown>)[keyField] as number

  const allSelected =
    hasSelection && data.length > 0 && data.every((row) => selectedRows!.has(getKey(row)))

  const someSelected =
    hasSelection && !allSelected && data.some((row) => selectedRows!.has(getKey(row)))

  // ── Sort state ──
  const [sortState, setSortState] = useState<SortState>({ key: '', direction: null })

  const handleHeaderClick = useCallback(
    (col: Column<T>) => {
      if (!col.sortable) return
      setSortState((prev) => {
        let next: SortDirection
        if (prev.key !== col.key) {
          next = 'asc'
        } else if (prev.direction === 'asc') {
          next = 'desc'
        } else if (prev.direction === 'desc') {
          next = null
        } else {
          next = 'asc'
        }
        const newState: SortState = { key: col.key, direction: next }
        onSort?.(newState)
        return newState
      })
    },
    [onSort],
  )

  // ── Filter state ──
  const [filters, setFilters] = useState<Record<string, string>>({})

  const hasAnyFilterable = columns.some((c) => c.filterable)

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // ── Column visibility ──
  const storageKeyVisibility = tableId ? `dt_vis_${tableId}` : null

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (!storageKeyVisibility) return new Set()
    const stored = loadFromStorage<string[]>(storageKeyVisibility, [])
    return new Set(stored)
  })

  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const columnMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showColumnMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColumnMenu])

  const toggleColumnVisibility = useCallback(
    (key: string) => {
      setHiddenColumns((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        if (storageKeyVisibility) {
          saveToStorage(storageKeyVisibility, [...next])
        }
        return next
      })
    },
    [storageKeyVisibility],
  )

  // ── Column resize ──
  const storageKeyWidths = tableId ? `dt_wid_${tableId}` : null

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (!storageKeyWidths) return {}
    return loadFromStorage<Record<string, number>>(storageKeyWidths, {})
  })

  const resizingRef = useRef<{
    key: string
    startX: number
    startWidth: number
  } | null>(null)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, col: Column<T>, thEl: HTMLTableCellElement) => {
      e.preventDefault()
      e.stopPropagation()
      const startWidth = columnWidths[col.key] || thEl.getBoundingClientRect().width
      resizingRef.current = { key: col.key, startX: e.clientX, startWidth }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return
        const diff = ev.clientX - resizingRef.current.startX
        const newWidth = Math.max(60, resizingRef.current.startWidth + diff)
        setColumnWidths((prev) => {
          const next = { ...prev, [resizingRef.current!.key]: newWidth }
          if (storageKeyWidths) saveToStorage(storageKeyWidths, next)
          return next
        })
      }

      const handleMouseUp = () => {
        resizingRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [columnWidths, storageKeyWidths],
  )

  // ── Visible columns ──
  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.has(col.key)),
    [columns, hiddenColumns],
  )

  // ── Processed data (client-side filter + sort) ──
  const processedData = useMemo(() => {
    let result = [...data]

    // Client-side filtering
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== '')
    if (activeFilters.length > 0) {
      result = result.filter((row) => {
        return activeFilters.every(([key, filterValue]) => {
          const col = columns.find((c) => c.key === key)
          if (!col || !col.filterable) return true

          // If the column has filterOptions, do exact match
          if (col.filterOptions && col.filterOptions.length > 0) {
            if (filterValue === '') return true
            const cellValue = String((row as Record<string, unknown>)[key] ?? '')
            return cellValue === filterValue
          }

          // Otherwise text match (case-insensitive)
          const cellValue = String((row as Record<string, unknown>)[key] ?? '').toLowerCase()
          return cellValue.includes(filterValue.toLowerCase())
        })
      })
    }

    // Client-side sorting (skip if onSort is provided — server handles it)
    if (!onSort && sortState.key && sortState.direction) {
      const { key, direction } = sortState
      result.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[key]
        const bVal = (b as Record<string, unknown>)[key]

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return direction === 'asc' ? -1 : 1
        if (bVal == null) return direction === 'asc' ? 1 : -1

        // Numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal
        }

        // String comparison
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        if (aStr < bStr) return direction === 'asc' ? -1 : 1
        if (aStr > bStr) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [data, filters, sortState, onSort, columns])

  const isMobile = useIsMobile()
  const showCards = mobileCardView && isMobile

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    )
  }

  // ── Render: empty (check original data, not filtered) ──
  if (!data.length) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted text-sm">
        {emptyMessage ?? t('common.noData', 'No data')}
      </div>
    )
  }

  // ── Render: mobile card view ──
  if (showCards) {
    return (
      <div className="space-y-3 px-1">
        {hasSelection && onSelectAll && (
          <label className="flex items-center gap-2 px-2 py-1 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected }}
              onChange={onSelectAll}
              className="h-4 w-4 rounded border-border bg-bg-input accent-accent-purple"
            />
            {t('table.selectAll', 'Select all')}
          </label>
        )}
        {processedData.map((row, idx) => {
          const rowId = getKey(row)
          return (
            <MobileCard
              key={rowId ?? idx}
              row={row}
              columns={visibleColumns}
              keyField={keyField}
              onClick={onRowClick}
              selected={hasSelection ? selectedRows!.has(rowId) : undefined}
              onSelect={onSelectRow}
              cardRender={cardRender}
            />
          )
        })}
        {processedData.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">
            {t('table.noResults', 'No matching results')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Column toggle button */}
      {columnToggle && tableId && (
        <div className="relative flex justify-end px-4 pt-3 pb-1" ref={columnMenuRef}>
          <button
            type="button"
            onClick={() => setShowColumnMenu((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium',
              'text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors',
            )}
            title={t('table.columnToggle', 'Toggle columns')}
          >
            <Settings2 size={14} />
            {t('table.columns', 'Columns')}
          </button>

          {showColumnMenu && (
            <div
              className={cn(
                'absolute right-4 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border',
                'bg-bg-card shadow-lg py-1',
              )}
            >
              <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border">
                {t('table.toggleColumns', 'Toggle Columns')}
              </div>
              {columns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-card-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col.key)}
                    onChange={() => toggleColumnVisibility(col.key)}
                    className="h-3.5 w-3.5 rounded border-border bg-bg-input accent-accent-purple"
                  />
                  {col.header || col.key}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={cn('overflow-x-auto', stickyHeader && 'max-h-[70vh] overflow-y-auto')}>
        <table className="w-full text-sm" style={{ tableLayout: Object.keys(columnWidths).length > 0 ? 'fixed' : undefined }}>
          <thead className={cn(stickyHeader && 'sticky top-0 z-10 bg-bg-card')}>
            {/* Header row */}
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
              {visibleColumns.map((col) => {
                const isSorted = sortState.key === col.key && sortState.direction
                const width = columnWidths[col.key]

                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.sortable && 'cursor-pointer select-none hover:text-text-primary',
                      col.className,
                    )}
                    style={{
                      width: width ? `${width}px` : undefined,
                      minWidth: col.resizable ? '60px' : undefined,
                      position: 'relative',
                    }}
                    onClick={() => handleHeaderClick(col)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.header}</span>
                      {col.sortable && isSorted && (
                        sortState.direction === 'asc' ? (
                          <ArrowUp size={12} className="text-accent-purple shrink-0" />
                        ) : (
                          <ArrowDown size={12} className="text-accent-purple shrink-0" />
                        )
                      )}
                      {col.sortable && !isSorted && (
                        <span className="text-text-muted/40 shrink-0 text-[10px]">{'\u2195'}</span>
                      )}
                    </div>

                    {/* Resize handle */}
                    {col.resizable && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-purple/30 active:bg-accent-purple/50"
                        onMouseDown={(e) => {
                          const thEl = e.currentTarget.parentElement as HTMLTableCellElement
                          handleResizeStart(e, col, thEl)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                )
              })}
            </tr>

            {/* Filter row */}
            {hasAnyFilterable && (
              <tr className="border-b border-border bg-bg-card">
                {hasSelection && <th className="px-4 py-1.5" />}
                {visibleColumns.map((col) => (
                  <th
                    key={`filter-${col.key}`}
                    className={cn(
                      'px-4 py-1.5',
                      col.hideOnMobile && 'hidden md:table-cell',
                    )}
                  >
                    {col.filterable ? (
                      col.filterOptions && col.filterOptions.length > 0 ? (
                        <div className="relative">
                          <select
                            value={filters[col.key] ?? ''}
                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                            className={cn(
                              'w-full rounded border border-border bg-bg-input px-2 py-1 text-xs text-text-primary',
                              'focus:outline-none focus:ring-1 focus:ring-accent-purple appearance-none pr-6',
                            )}
                          >
                            <option value="">{t('table.all', 'All')}</option>
                            {col.filterOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={filters[col.key] ?? ''}
                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                            placeholder={t('table.filter', 'Filter...')}
                            className={cn(
                              'w-full rounded border border-border bg-bg-input px-2 py-1 text-xs text-text-primary',
                              'placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent-purple',
                              filters[col.key] ? 'pr-6' : '',
                            )}
                          />
                          {filters[col.key] && (
                            <button
                              type="button"
                              onClick={() => clearFilter(col.key)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      )
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (hasSelection ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm text-text-muted"
                >
                  {t('table.noResults', 'No matching results')}
                </td>
              </tr>
            ) : (
              processedData.map((row, idx) => {
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
                    {visibleColumns.map((col) => (
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
