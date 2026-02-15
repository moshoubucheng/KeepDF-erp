import { cn } from '@/utils/cn'
import { SearchInput } from './SearchInput'
import { CsvExportButton } from './CsvExportButton'

export interface FilterOption {
  value: string
  label: string
}

export interface SelectFilter {
  key: string
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export interface FilterBarProps {
  filters?: SelectFilter[]
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  exportFn?: () => Promise<void>
  exportLabel?: string
  actions?: React.ReactNode
  className?: string
}

export function FilterBar({
  filters,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  exportFn,
  exportLabel,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3',
        className,
      )}
    >
      {/* Search */}
      {onSearchChange && (
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full sm:w-64"
        />
      )}

      {/* Select Filters */}
      {filters?.map((filter) => (
        <select
          key={filter.key}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          aria-label={filter.label}
          className={cn(
            'rounded-lg border border-border bg-bg-input px-3 py-2',
            'text-sm text-text-primary',
            'outline-none transition-colors',
            'focus:border-border-hover focus:ring-1 focus:ring-accent-purple/30',
          )}
        >
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {/* Spacer pushes actions to the right on wider screens */}
      <div className="hidden sm:block sm:flex-1" />

      {/* Action Buttons */}
      {exportFn && (
        <CsvExportButton exportFn={exportFn} label={exportLabel} />
      )}
      {actions}
    </div>
  )
}
