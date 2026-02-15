import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
  className?: string
}

export function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  delay = 300,
  className,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(controlledValue ?? '')
  const debouncedValue = useDebounce(localValue, delay)
  const isFirstRender = useRef(true)

  // Sync with controlled value from parent
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== localValue) {
      setLocalValue(controlledValue)
    }
    // Only sync when controlledValue changes from outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue])

  // Emit debounced value to parent
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChange(debouncedValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onChange('')
  }, [onChange])

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border border-border bg-bg-input py-2 pl-9 pr-8',
          'text-sm text-text-primary placeholder:text-text-muted',
          'outline-none transition-colors',
          'focus:border-border-hover focus:ring-1 focus:ring-accent-purple/30',
        )}
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
